package main

import (
	"encoding/json"
	"errors"
	"log"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type createDayRequest struct {
	Text string `json:"text"`
	// PhotoURI is kept as the required primary cover for backwards compatibility.
	PhotoURI  string     `json:"photoUri"`
	PhotoURIs []string   `json:"photoUris"`
	SongQuery string     `json:"songQuery"`
	Track     *TrackInfo `json:"track"`
}

func firstFormValue(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func (s *apiServer) createDay(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var input createDayRequest
	if strings.HasPrefix(c.Get("Content-Type"), "multipart/form-data") {
		form, err := c.MultipartForm()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Некорректная загрузка фотографии",
			})
		}

		input.Text = firstFormValue(form.Value["text"])
		if err := json.Unmarshal([]byte(firstFormValue(form.Value["track"])), &input.Track); err != nil {
			input.Track = nil
		}

		files := append(form.File["photo"], form.File["photos"]...)
		if len(files) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Добавь фотографию дня",
			})
		}

		for _, file := range files {
			extension := strings.ToLower(filepath.Ext(file.Filename))
			if extension != ".jpg" && extension != ".jpeg" && extension != ".png" && extension != ".heic" {
				extension = ".jpg"
			}
			filename := uuid.NewString() + extension
			photoPath := filepath.Join("uploads", filename)
			if err := c.SaveFile(file, photoPath); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "Не удалось сохранить фотографию",
				})
			}
			input.PhotoURIs = append(input.PhotoURIs, c.BaseURL()+"/uploads/"+filename)
		}
		input.PhotoURI = input.PhotoURIs[0]
	}

	if input.PhotoURI == "" {
		if err := c.BodyParser(&input); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Некорректный JSON",
			})
		}
	}

	input.Text = strings.TrimSpace(input.Text)
	input.PhotoURI = strings.TrimSpace(input.PhotoURI)
	input.PhotoURIs = normalizePhotoURIs(input.PhotoURI, input.PhotoURIs)
	input.SongQuery = strings.TrimSpace(input.SongQuery)

	if len([]rune(input.Text)) < 10 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Опиши день минимум десятью символами",
		})
	}

	if input.PhotoURI == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Добавь фотографию дня",
		})
	}

	if input.Track == nil && input.SongQuery == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Добавь песню дня",
		})
	}

	track, err := resolveTrack(input)
	if err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error": "Не удалось найти трек с доступным preview",
		})
	}

	folderTitle, style := analyzeDay(input.Text, track)
	now := time.Now().UTC()

	day := Day{
		ID:          uuid.NewString(),
		UserID:      userID,
		Date:        now.Format("2006-01-02"),
		FolderTitle: folderTitle,
		Text:        input.Text,
		PhotoURI:    input.PhotoURI,
		PhotoURIs:   input.PhotoURIs,
		Track:       track,
		Style:       style,
		CreatedAt:   now,
	}

	trackJSON, err := json.Marshal(day.Track)
	if err != nil {
		log.Printf("encode track for PostgreSQL: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось сохранить запись",
		})
	}
	styleJSON, err := json.Marshal(day.Style)
	if err != nil {
		log.Printf("encode style for PostgreSQL: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось сохранить запись",
		})
	}

	err = s.db.QueryRow(c.UserContext(),
		`INSERT INTO days (id, user_id, date, folder_title, text, photo_uri, photo_uris, track, style)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING created_at`,
		day.ID,
		day.UserID,
		day.Date,
		day.FolderTitle,
		day.Text,
		day.PhotoURI,
		day.PhotoURIs,
		trackJSON,
		styleJSON,
	).Scan(&day.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) &&
			pgErr.Code == "23503" &&
			pgErr.ConstraintName == "days_user_id_fkey" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Пользователь не найден. Войдите в аккаунт снова",
			})
		}
		log.Printf("insert day in PostgreSQL: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось сохранить запись",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"day": day,
	})
}

func (s *apiServer) getDays(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	rows, err := s.db.Query(c.UserContext(),
		`SELECT id, user_id, date, folder_title, text, photo_uri, photo_uris, track, style, created_at
		 FROM days
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		log.Printf("load days from PostgreSQL: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось загрузить записи",
		})
	}
	defer rows.Close()

	userDays := make([]Day, 0)
	for rows.Next() {
		day, err := scanDay(rows)
		if err != nil {
			log.Printf("decode day from PostgreSQL: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Не удалось загрузить записи",
			})
		}
		userDays = append(userDays, day)
	}
	if err := rows.Err(); err != nil {
		log.Printf("iterate days from PostgreSQL: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось загрузить записи",
		})
	}

	return c.JSON(fiber.Map{
		"days": userDays,
	})
}

func (s *apiServer) getDayByID(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	dayID := c.Params("id")

	day, err := scanDay(s.db.QueryRow(c.UserContext(),
		`SELECT id, user_id, date, folder_title, text, photo_uri, photo_uris, track, style, created_at
		 FROM days
		 WHERE id = $1 AND user_id = $2`,
		dayID,
		userID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Запись не найдена",
		})
	}
	if err != nil {
		log.Printf("load day from PostgreSQL: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось загрузить запись",
		})
	}

	return c.JSON(fiber.Map{
		"day": day,
	})
}

// normalizePhotoURIs makes the album deterministic for all callers. The legacy
// cover is always first, and duplicate or empty entries do not reach the database.
func normalizePhotoURIs(photoURI string, photoURIs []string) []string {
	result := make([]string, 0, len(photoURIs)+1)
	seen := make(map[string]struct{}, len(photoURIs)+1)
	for _, uri := range append([]string{photoURI}, photoURIs...) {
		uri = strings.TrimSpace(uri)
		if uri == "" {
			continue
		}
		if _, exists := seen[uri]; exists {
			continue
		}
		seen[uri] = struct{}{}
		result = append(result, uri)
	}
	return result
}

func resolveTrack(input createDayRequest) (TrackInfo, error) {
	if input.Track != nil && strings.TrimSpace(input.Track.Title) != "" {
		track := *input.Track

		if track.Energy <= 0 {
			track.Energy = energyByGenre(track.Genre)
		}

		return track, nil
	}

	results, err := searchITunes(input.SongQuery)
	if err != nil {
		return TrackInfo{}, err
	}

	if len(results) == 0 {
		return TrackInfo{}, errors.New("track not found")
	}

	result := results[0]

	return TrackInfo{
		ID:         result.ID,
		Title:      result.Title,
		Artist:     result.Artist,
		PreviewURL: result.PreviewURL,
		Genre:      result.Genre,
		ArtworkURL: result.ArtworkURL,
		TrackURL:   result.TrackURL,
		Energy:     result.Energy,
	}, nil
}

func analyzeDay(text string, track TrackInfo) (string, StyleRecipe) {
	type moodRule struct {
		title        string
		textSignals  []string
		musicSignals []string
		recipe       StyleRecipe
	}

	rules := []moodRule{
		{
			title:        "Город на высокой скорости",
			textSignals:  []string{"бег", "скорост", "энерг", "танц", "концерт", "вечерин", "гонк", "путешеств"},
			musicSignals: []string{"rock", "phonk", "techno", "electronic", "dance"},
			recipe: StyleRecipe{
				Palette:           [3]string{"#121417", "#D9534F", "#F4F4F4"},
				GrainIntensity:    0.20,
				ArtStyle:          "minimal_editorial",
				TypographyVariant: "mono_archive",
			},
		},
		{
			title:        "Солнечный день среди близких",
			textSignals:  []string{"любим", "друз", "семь", "солнц", "лет", "смех", "радост", "объят", "пикник", "море", "пляж"},
			musicSignals: []string{"folk", "acoustic", "pop"},
			recipe: StyleRecipe{
				Palette:           [3]string{"#18251F", "#E7AF5A", "#FFF1D6"},
				GrainIntensity:    0.24,
				ArtStyle:          "dreamy_aura",
				TypographyVariant: "serif_editorial",
			},
		},
		{
			title:        "Тёплый вечер после дождя",
			textSignals:  []string{"дожд", "вечер", "кофе", "ностальг", "уют", "тихо", "спокой", "утро", "книг", "прогулк"},
			musicSignals: []string{"jazz", "indie", "ambient"},
			recipe: StyleRecipe{
				Palette:           [3]string{"#181B24", "#E89B4B", "#F2EDE4"},
				GrainIntensity:    0.45,
				ArtStyle:          "analog_film",
				TypographyVariant: "serif_editorial",
			},
		},
		{
			title:        "Свет между небом и морем",
			textSignals:  []string{"рассвет", "закат", "звезд", "мечт", "туман", "океан"},
			musicSignals: []string{"dream", "classical"},
			recipe: StyleRecipe{
				Palette:           [3]string{"#172333", "#8AAED0", "#F1EBDD"},
				GrainIntensity:    0.18,
				ArtStyle:          "dreamy_aura",
				TypographyVariant: "serif_editorial",
			},
		},
	}

	narrative := strings.ToLower(text)
	music := strings.ToLower(strings.Join([]string{track.Title, track.Artist, track.Genre}, " "))
	energy := track.Energy
	if energy <= 0 {
		energy = energyByGenre(track.Genre)
	}
	if energy > 1 {
		energy = 1
	}

	bestTitle := "Тихий свет обычного дня"
	bestRecipe := StyleRecipe{
		Palette:           [3]string{"#1C1917", "#D4A373", "#FAEDCD"},
		GrainIntensity:    0.50,
		ArtStyle:          "analog_film",
		TypographyVariant: "serif_editorial",
	}
	bestScore := 0
	for _, rule := range rules {
		score := countSignalMatches(narrative, rule.textSignals)*3 +
			countSignalMatches(music, rule.musicSignals)
		if rule.title == "Город на высокой скорости" && energy >= 0.75 {
			score++
		}
		if score > bestScore {
			bestTitle = rule.title
			bestRecipe = rule.recipe
			bestScore = score
		}
	}

	bestRecipe.MotionSpeed = 0.45 + energy*0.95
	return bestTitle, bestRecipe
}

func countSignalMatches(value string, terms []string) int {
	matches := 0
	for _, term := range terms {
		if strings.Contains(value, term) {
			matches++
		}
	}
	return matches
}
