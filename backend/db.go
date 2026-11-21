package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type apiServer struct {
	db *pgxpool.Pool
}

func InitDB() (*pgxpool.Pool, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL не задан в .env или переменных окружения")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	var pool *pgxpool.Pool
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		pool, err := pgxpool.New(ctx, dsn)
		if err != nil {
			return nil, fmt.Errorf("ошибка инициализации пула: %w", err)
		}

		pingCtx, pingCancel := context.WithTimeout(ctx, 3*time.Second)
		lastErr = pool.Ping(pingCtx)
		pingCancel()
		if lastErr == nil {
			break
		}
		pool.Close()
		pool = nil

		if attempt == 4 {
			break
		}
		delay := time.Duration(250*(1<<attempt)) * time.Millisecond
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, fmt.Errorf("подключение к PostgreSQL прервано: %w", ctx.Err())
		case <-timer.C:
		}
	}
	if pool == nil {
		return nil, fmt.Errorf("нет связи с PostgreSQL после нескольких попыток: %w", lastErr)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		handle TEXT NOT NULL DEFAULT '',
		bio TEXT NOT NULL DEFAULT '',
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS days (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		date TEXT NOT NULL,
		folder_title TEXT NOT NULL,
		text TEXT NOT NULL,
		photo_uri TEXT NOT NULL,
		photo_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
		track JSONB NOT NULL,
		style JSONB NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	ALTER TABLE days
		ADD COLUMN IF NOT EXISTS photo_uris JSONB NOT NULL DEFAULT '[]'::jsonb;

	CREATE INDEX IF NOT EXISTS idx_days_user_created
		ON days (user_id, created_at DESC);
	`

	if _, err := pool.Exec(ctx, schema); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ошибка создания таблиц: %w", err)
	}

	return pool, nil
}

func scanDay(row pgx.Row) (Day, error) {
	var day Day
	var photoURIsJSON, trackJSON, styleJSON []byte

	if err := row.Scan(
		&day.ID,
		&day.UserID,
		&day.Date,
		&day.FolderTitle,
		&day.Text,
		&day.PhotoURI,
		&photoURIsJSON,
		&trackJSON,
		&styleJSON,
		&day.CreatedAt,
	); err != nil {
		return Day{}, err
	}

	if len(photoURIsJSON) > 0 {
		if err := json.Unmarshal(photoURIsJSON, &day.PhotoURIs); err != nil {
			day.PhotoURIs = nil
		}
	}
	if len(day.PhotoURIs) == 0 && day.PhotoURI != "" {
		day.PhotoURIs = []string{day.PhotoURI}
	}

	if err := json.Unmarshal(trackJSON, &day.Track); err != nil {
		return Day{}, fmt.Errorf("decode track for day %s: %w", day.ID, err)
	}
	if err := json.Unmarshal(styleJSON, &day.Style); err != nil {
		return Day{}, fmt.Errorf("decode style for day %s: %w", day.ID, err)
	}

	day.Mood = day.Style.Mood

	return day, nil
}
