package main

import (
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type createDayRequest struct {
	Text      string     `json:"text"`
	PhotoURI  string     `json:"photoUri"`
	SongQuery string     `json:"songQuery"`
	Track     *TrackInfo `json:"track"`
}

func (s *apiServer) createDay(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var input createDayRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Некорректный JSON",
		})
	}

	input.Text = strings.TrimSpace(input.Text)
	input.PhotoURI = strings.TrimSpace(input.PhotoURI)
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
		`INSERT INTO days (id, user_id, date, folder_title, text, photo_uri, track, style)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING created_at`,
		day.ID,
		day.UserID,
		day.Date,
		day.FolderTitle,
		day.Text,
		day.PhotoURI,
		trackJSON,
		styleJSON,
	).Scan(&day.CreatedAt)
	if err != nil {
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
		`SELECT id, user_id, date, folder_title, text, photo_uri, track, style, created_at
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
		`SELECT id, user_id, date, folder_title, text, photo_uri, track, style, created_at
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
	source := strings.ToLower(text + " " + track.Title + " " + track.Genre)

	if track.Energy >= 0.75 ||
		containsAny(source, "rock", "phonk", "techno", "electronic", "бег", "скорост", "энерг") {
		return "Город на высокой скорости", StyleRecipe{
			Palette:           [3]string{"#121417", "#D9534F", "#F4F4F4"},
			GrainIntensity:    0.20,
			ArtStyle:          "minimal_editorial",
			MotionSpeed:       1.40,
			TypographyVariant: "mono_archive",
		}
	}

	if containsAny(source, "дожд", "вечер", "кофе", "ностальг", "indie", "jazz") {
		return "Тёплый вечер после дождя", StyleRecipe{
			Palette:           [3]string{"#181B24", "#E89B4B", "#F2EDE4"},
			GrainIntensity:    0.45,
			ArtStyle:          "analog_film",
			MotionSpeed:       0.50,
			TypographyVariant: "serif_editorial",
		}
	}

	return "Тихий свет обычного дня", StyleRecipe{
		Palette:           [3]string{"#1C1917", "#D4A373", "#FAEDCD"},
		GrainIntensity:    0.50,
		ArtStyle:          "analog_film",
		MotionSpeed:       0.45,
		TypographyVariant: "serif_editorial",
	}
}

func containsAny(value string, terms ...string) bool {
	for _, term := range terms {
		if strings.Contains(value, term) {
			return true
		}
	}

	return false
}
