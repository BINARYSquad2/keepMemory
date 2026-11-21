package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const maxAlbumPhotos = 6

type createDayRequest struct {
	Text         string     `json:"text"`
	PhotoURI     string     `json:"photoUri"`
	PhotoURIs    []string   `json:"photoUris"`
	SongQuery    string     `json:"songQuery"`
	Track        *TrackInfo `json:"track"`
	AllowCloudAI bool       `json:"allowCloudAI"`
}

func firstFormValue(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func uploadsDir() string {
	dir := strings.TrimSpace(os.Getenv("UPLOADS_DIR"))
	if dir == "" {
		return "uploads"
	}
	return dir
}

func (s *apiServer) createDay(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var input createDayRequest
	var localPhotoPaths []string
	filesCommitted := false
	defer func() {
		if !filesCommitted {
			for _, diskPath := range localPhotoPaths {
				if err := os.Remove(diskPath); err != nil && !errors.Is(err, os.ErrNotExist) {
					log.Printf("remove uncommitted uploaded photo: %v", err)
				}
			}
		}
	}()

	if strings.HasPrefix(c.Get("Content-Type"), "multipart/form-data") {
		form, err := c.MultipartForm()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Некорректная загрузка фотографий",
			})
		}

		input.Text = firstFormValue(form.Value["text"])
		if trackRaw := firstFormValue(form.Value["track"]); trackRaw != "" {
			if err := json.Unmarshal([]byte(trackRaw), &input.Track); err != nil {
				input.Track = nil
			}
		}

		var uploadedFiles []*multipart.FileHeader
		uploadedFiles = append(uploadedFiles, form.File["photo"]...)
		uploadedFiles = append(uploadedFiles, form.File["photos"]...)

		if rawConsent := firstFormValue(form.Value["allowCloudAI"]); rawConsent == "true" {
			input.AllowCloudAI = true
		}

		if len(uploadedFiles) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Добавьте хотя бы одну фотографию дня",
			})
		}
		if len(uploadedFiles) > maxAlbumPhotos {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "В один день можно добавить не более шести фотографий",
			})
		}

		dir := uploadsDir()
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Printf("create uploads dir: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Не удалось подготовить хранилище фотографий",
			})
		}
		userDir := filepath.Join(dir, userID)
		if err := os.MkdirAll(userDir, 0700); err != nil {
			log.Printf("create user media directory: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Не удалось подготовить хранилище фотографий",
			})
		}

		savedURIs := make([]string, 0, len(uploadedFiles))
		for _, file := range uploadedFiles {
			if file.Size <= 0 || file.Size > 15*1024*1024 {
				return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
					"error": "Размер одной фотографии не должен превышать 15 МБ",
				})
			}
			extension, err := validatedPhotoExtension(file)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "Загрузите фотографию в формате JPEG, PNG, WebP или HEIC",
				})
			}
			filename := uuid.NewString() + extension
			diskPath := filepath.Join(userDir, filename)
			if err := c.SaveFile(file, diskPath); err != nil {
				_ = os.Remove(diskPath)
				log.Printf("save uploaded photo: %v", err)
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "Не удалось сохранить фотографию",
				})
			}
			if err := os.Chmod(diskPath, 0600); err != nil {
				log.Printf("restrict uploaded photo permissions: %v", err)
			}
			savedURIs = append(savedURIs, "/api/media/"+userID+"/"+filename)
			localPhotoPaths = append(localPhotoPaths, diskPath)
		}

		input.PhotoURI = savedURIs[0]
		input.PhotoURIs = savedURIs
	} else {
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

	photoURIs := normalizePhotoURIs(input.PhotoURI, input.PhotoURIs)
	if len(localPhotoPaths) == 0 {
		for _, uri := range photoURIs {
			if mediaFilename(uri) != "" {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "Загрузите фотографию через форму, а не передавайте путь к файлу",
				})
			}
		}
	}
	if len(photoURIs) > 0 {
		input.PhotoURI = photoURIs[0]
	}

	textLength := len([]rune(input.Text))
	if textLength < 10 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Опишите день минимум десятью символами",
		})
	}
	if textLength > 4000 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Запись не должна быть длиннее 4000 символов",
		})
	}

	if input.PhotoURI == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Добавьте фотографию дня",
		})
	}

	if input.Track == nil && input.SongQuery == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Добавьте песню дня",
		})
	}

	trackCtx, cancelTrack := context.WithTimeout(c.UserContext(), 18*time.Second)
	defer cancelTrack()
	track, err := resolveTrack(trackCtx, input)
	if err != nil {
		if isTransientUpstreamError(err) {
			c.Set(fiber.HeaderRetryAfter, "2")
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "Сервис музыки временно недоступен. Попробуйте сохранить запись ещё раз.",
			})
		}
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error": "Не удалось найти трек с доступным фрагментом",
		})
	}

	user, err := s.loadUserContext(c.UserContext(), userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Пользователь не найден",
		})
	}
	if err != nil {
		return databaseErrorResponse(c, err, "load user context", "Не удалось подготовить запись")
	}
	recentDays, err := s.loadRecentDays(c.UserContext(), userID, 5)
	if err != nil {
		return databaseErrorResponse(c, err, "load recent days", "Не удалось подготовить запись")
	}

	folderTitle, style := generateDayRecipe(
		c.UserContext(),
		user,
		recentDays,
		input.Text,
		track,
		localPhotoPaths,
		len(photoURIs),
		input.AllowCloudAI,
	)
	now := time.Now().UTC()

	day := Day{
		ID:          uuid.NewString(),
		UserID:      userID,
		Date:        now.Format("2006-01-02"),
		FolderTitle: folderTitle,
		Text:        input.Text,
		PhotoURI:    input.PhotoURI,
		PhotoURIs:   photoURIs,
		Mood:        style.Mood,
		Track:       track,
		Style:       style,
		CreatedAt:   now,
	}

	photoURIsJSON, err := json.Marshal(day.PhotoURIs)
	if err != nil {
		log.Printf("encode photoUris for PostgreSQL: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось сохранить запись",
		})
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
		photoURIsJSON,
		trackJSON,
		styleJSON,
	).Scan(&day.CreatedAt)
	if err != nil {
		return databaseErrorResponse(c, err, "insert day in PostgreSQL", "Не удалось сохранить запись")
	}
	filesCommitted = true

	if err := signDayMedia(&day); err != nil {
		log.Printf("sign media URLs: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось подготовить фотографии записи",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"day": day,
	})
}

func (s *apiServer) getDays(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	moodFilter := strings.ToLower(strings.TrimSpace(c.Query("mood")))
	searchQuery := strings.ToLower(strings.TrimSpace(c.Query("q")))

	rows, err := s.db.Query(c.UserContext(),
		`SELECT id, user_id, date, folder_title, text, photo_uri, photo_uris, track, style, created_at
		 FROM days
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return databaseErrorResponse(c, err, "load days from PostgreSQL", "Не удалось загрузить записи")
	}
	defer rows.Close()

	userDays := make([]Day, 0)
	for rows.Next() {
		day, err := scanDay(rows)
		if err != nil {
			return databaseErrorResponse(c, err, "decode day from PostgreSQL", "Не удалось загрузить записи")
		}

		if moodFilter != "" && moodFilter != "all" && strings.ToLower(day.Mood) != moodFilter {
			continue
		}
		if searchQuery != "" {
			haystack := strings.ToLower(strings.Join([]string{
				day.FolderTitle,
				day.Text,
				day.Date,
				day.Track.Title,
				day.Track.Artist,
				day.Track.Genre,
				day.Style.MoodLabel,
			}, " "))
			if !strings.Contains(haystack, searchQuery) {
				continue
			}
		}

		if err := signDayMedia(&day); err != nil {
			log.Printf("sign media URLs: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Не удалось подготовить фотографии записей",
			})
		}
		userDays = append(userDays, day)
	}
	if err := rows.Err(); err != nil {
		return databaseErrorResponse(c, err, "iterate days from PostgreSQL", "Не удалось загрузить записи")
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
		return databaseErrorResponse(c, err, "load day from PostgreSQL", "Не удалось загрузить запись")
	}

	if err := signDayMedia(&day); err != nil {
		log.Printf("sign media URLs: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось подготовить фотографии записи",
		})
	}

	return c.JSON(fiber.Map{
		"day": day,
	})
}

func (s *apiServer) deleteDay(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	dayID := c.Params("id")

	var coverURI string
	var photoURIsJSON []byte
	err := s.db.QueryRow(c.UserContext(),
		`DELETE FROM days
		 WHERE id = $1 AND user_id = $2
		 RETURNING photo_uri, photo_uris`,
		dayID,
		userID,
	).Scan(&coverURI, &photoURIsJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Запись не найдена",
		})
	}
	if err != nil {
		return databaseErrorResponse(c, err, "delete day from PostgreSQL", "Не удалось удалить запись")
	}

	var photoURIs []string
	if err := json.Unmarshal(photoURIsJSON, &photoURIs); err != nil {
		log.Printf("decode deleted day media references: %v", err)
	}

	cleanupWarning := false
	for _, uri := range normalizePhotoURIs(coverURI, photoURIs) {
		filename := mediaFilename(uri)
		if filename == "" || !isOwnedUploadFilename(filename) {
			continue
		}

		currentURI := "/api/media/" + userID + "/" + filename
		legacyURI := "/uploads/" + filename
		var stillReferenced bool
		err := s.db.QueryRow(c.UserContext(),
			`SELECT EXISTS (
				SELECT 1 FROM days
				WHERE photo_uri IN ($1, $2)
				   OR photo_uris ? $1
				   OR photo_uris ? $2
			)`,
			currentURI,
			legacyURI,
		).Scan(&stillReferenced)
		if err != nil {
			log.Printf("check remaining media references: %v", err)
			cleanupWarning = true
			continue
		}
		if stillReferenced {
			continue
		}

		owner, _, legacy := mediaLocation(uri)
		mediaPath := filepath.Join(uploadsDir(), userID, filename)
		if legacy {
			mediaPath = filepath.Join(uploadsDir(), filename)
		} else if owner != "" && owner != userID {
			cleanupWarning = true
			continue
		}
		if err := os.Remove(mediaPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			log.Printf("remove deleted day media: %v", err)
			cleanupWarning = true
		}
	}
	response := fiber.Map{"deleted": true}
	if cleanupWarning {
		response["warning"] = "Запись удалена, но часть файлов не удалось очистить"
	}
	return c.JSON(response)
}

func (s *apiServer) loadUserContext(ctx context.Context, userID string) (User, error) {
	var user User
	err := s.db.QueryRow(ctx,
		`SELECT id, email, name, handle, bio, created_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(
		&user.ID,
		&user.Email,
		&user.DisplayName,
		&user.Handle,
		&user.Bio,
		&user.CreatedAt,
	)
	if err != nil {
		return User{}, err
	}
	return user, nil
}

func (s *apiServer) loadRecentDays(ctx context.Context, userID string, limit int) ([]Day, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, date, folder_title, text, photo_uri, photo_uris, track, style, created_at
		 FROM days
		 WHERE user_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2`,
		userID,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	days := make([]Day, 0, limit)
	for rows.Next() {
		day, err := scanDay(rows)
		if err != nil {
			return nil, err
		}
		days = append(days, day)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return days, nil
}

func normalizePhotoURIs(cover string, list []string) []string {
	result := make([]string, 0, maxAlbumPhotos)
	seen := make(map[string]struct{}, maxAlbumPhotos)

	add := func(uri string) {
		clean := strings.TrimSpace(uri)
		if clean == "" || len(result) >= maxAlbumPhotos {
			return
		}
		if _, exists := seen[clean]; exists {
			return
		}
		seen[clean] = struct{}{}
		result = append(result, clean)
	}

	add(cover)
	for _, uri := range list {
		add(uri)
	}
	return result
}

func resolveTrack(ctx context.Context, input createDayRequest) (TrackInfo, error) {
	if input.Track != nil && strings.TrimSpace(input.Track.Title) != "" {
		track := *input.Track

		if track.Energy <= 0 {
			track.Energy = energyByGenre(track.Genre)
		}

		return track, nil
	}

	results, err := searchITunes(ctx, input.SongQuery)
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

func containsAny(value string, terms ...string) bool {
	for _, term := range terms {
		if strings.Contains(value, term) {
			return true
		}
	}
	return false
}
