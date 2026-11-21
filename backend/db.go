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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("ошибка инициализации пула: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("нет связи с PostgreSQL (проверь пароль и порт в .env): %w", err)
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
		photo_uris TEXT[] NOT NULL DEFAULT '{}',
		track JSONB NOT NULL,
		style JSONB NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	`

	if _, err := pool.Exec(ctx, schema); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ошибка создания таблиц: %w", err)
	}

	// Existing Railway databases predate the album column. Keep their cover image
	// as the first album item, so old records and new application versions agree.
	if _, err := pool.Exec(ctx, `
		ALTER TABLE days ADD COLUMN IF NOT EXISTS photo_uris TEXT[] NOT NULL DEFAULT '{}';
		UPDATE days SET photo_uris = ARRAY[photo_uri]
		WHERE COALESCE(cardinality(photo_uris), 0) = 0;
	`); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ошибка миграции альбома фотографий: %w", err)
	}

	return pool, nil
}

func scanDay(row pgx.Row) (Day, error) {
	var day Day
	var trackJSON, styleJSON []byte

	if err := row.Scan(
		&day.ID,
		&day.UserID,
		&day.Date,
		&day.FolderTitle,
		&day.Text,
		&day.PhotoURI,
		&day.PhotoURIs,
		&trackJSON,
		&styleJSON,
		&day.CreatedAt,
	); err != nil {
		return Day{}, err
	}

	if err := json.Unmarshal(trackJSON, &day.Track); err != nil {
		return Day{}, fmt.Errorf("decode track for day %s: %w", day.ID, err)
	}
	if err := json.Unmarshal(styleJSON, &day.Style); err != nil {
		return Day{}, fmt.Errorf("decode style for day %s: %w", day.ID, err)
	}

	return day, nil
}
