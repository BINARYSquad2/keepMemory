package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

const (
	maxBackupDays  = 5000
	maxBackupBytes = 100 * 1024 * 1024
)

type backupManifest struct {
	FormatVersion int       `json:"formatVersion"`
	ExportedAt    time.Time `json:"exportedAt"`
	User          User      `json:"user"`
	Days          []Day     `json:"days"`
	MediaFiles    []string  `json:"mediaFiles"`
	Warnings      []string  `json:"warnings,omitempty"`
}

func (s *apiServer) downloadBackup(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var user User
	err := s.db.QueryRow(c.UserContext(),
		`SELECT id, email, name, handle, bio, created_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.DisplayName, &user.Handle, &user.Bio, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Пользователь не найден"})
	}
	if err != nil {
		return databaseErrorResponse(c, err, "load backup profile", "Не удалось подготовить резервную копию")
	}

	rows, err := s.db.Query(c.UserContext(),
		`SELECT id, user_id, date, folder_title, text, photo_uri, photo_uris, track, style, created_at
		 FROM days
		 WHERE user_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2`,
		userID,
		maxBackupDays+1,
	)
	if err != nil {
		return databaseErrorResponse(c, err, "load backup days", "Не удалось подготовить резервную копию")
	}
	defer rows.Close()

	days := make([]Day, 0)
	files := make(map[string]string)
	warnings := make([]string, 0)
	totalMediaBytes := int64(0)
	for rows.Next() {
		day, err := scanDay(rows)
		if err != nil {
			log.Printf("decode backup day: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Не удалось подготовить резервную копию",
			})
		}
		days = append(days, day)
		if len(days) > maxBackupDays {
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"error": "Слишком много записей для одной резервной копии",
			})
		}

		for _, uri := range normalizePhotoURIs(day.PhotoURI, day.PhotoURIs) {
			owner, filename, legacy := mediaLocation(uri)
			if filename == "" || !isOwnedUploadFilename(filename) {
				continue
			}
			if owner != "" && owner != userID {
				warnings = append(warnings, "Пропущен файл с несовпадающим владельцем")
				continue
			}

			mediaPath := filepath.Join(uploadsDir(), userID, filename)
			if legacy {
				mediaPath = filepath.Join(uploadsDir(), filename)
				if _, err := os.Stat(mediaPath); err != nil {
					mediaPath = filepath.Join(uploadsDir(), userID, filename)
				}
			}
			info, err := os.Stat(mediaPath)
			if err != nil || !info.Mode().IsRegular() {
				warnings = append(warnings, "Не найден файл media/"+filename)
				continue
			}
			if _, exists := files[filename]; exists {
				continue
			}
			totalMediaBytes += info.Size()
			if totalMediaBytes > maxBackupBytes {
				return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
					"error": "Размер фотографий превышает лимит резервной копии 100 МБ",
				})
			}
			files[filename] = mediaPath
		}
	}
	if err := rows.Err(); err != nil {
		return databaseErrorResponse(c, err, "iterate backup days", "Не удалось подготовить резервную копию")
	}

	fileNames := make([]string, 0, len(files))
	for filename := range files {
		fileNames = append(fileNames, filename)
	}
	sort.Strings(fileNames)
	manifest := backupManifest{
		FormatVersion: 1,
		ExportedAt:    time.Now().UTC(),
		User:          user,
		Days:          days,
		MediaFiles:    make([]string, 0, len(fileNames)),
		Warnings:      warnings,
	}
	for _, filename := range fileNames {
		manifest.MediaFiles = append(manifest.MediaFiles, "media/"+filename)
	}

	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось подготовить резервную копию",
		})
	}
	manifestWriter, err := writer.Create("manifest.json")
	if err == nil {
		_, err = manifestWriter.Write(manifestBytes)
	}
	if err != nil {
		_ = writer.Close()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось подготовить резервную копию",
		})
	}

	for _, filename := range fileNames {
		input, err := os.Open(files[filename])
		if err != nil {
			_ = writer.Close()
			log.Printf("open backup media: %v", err)
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "Один из файлов изменился во время подготовки резервной копии",
			})
		}
		entry, err := writer.Create("media/" + filename)
		if err == nil {
			_, err = io.Copy(entry, input)
		}
		closeErr := input.Close()
		if err == nil {
			err = closeErr
		}
		if err != nil {
			_ = writer.Close()
			log.Printf("write backup media: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Не удалось упаковать фотографии",
			})
		}
		if archive.Len() > maxBackupBytes+10*1024*1024 {
			_ = writer.Close()
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"error": "Резервная копия превышает допустимый размер",
			})
		}
	}

	if err := writer.Close(); err != nil {
		log.Printf("close backup archive: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось завершить резервную копию",
		})
	}
	if archive.Len() > maxBackupBytes+10*1024*1024 {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
			"error": "Резервная копия превышает допустимый размер",
		})
	}

	c.Set(fiber.HeaderContentType, "application/zip")
	c.Set(fiber.HeaderContentDisposition,
		fmt.Sprintf(`attachment; filename="keepmemory-backup-%s.zip"`, time.Now().UTC().Format("20060102")))
	return c.Send(archive.Bytes())
}
