package main

import "time"

// User — аккаунт владельца дневника.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"displayName"`
	Handle       string    `json:"handle"`
	Bio          string    `json:"bio"`
	CreatedAt    time.Time `json:"createdAt"`
}

type TrackInfo struct {
	ID         int64   `json:"id"`
	Title      string  `json:"title"`
	Artist     string  `json:"artist"`
	PreviewURL string  `json:"previewUrl"`
	Genre      string  `json:"genre"`
	ArtworkURL string  `json:"artworkUrl"`
	TrackURL   string  `json:"trackUrl"`
	Energy     float64 `json:"energy"`
}

type StyleRecipe struct {
	Palette             [3]string `json:"palette"`
	GrainIntensity      float64   `json:"grainIntensity"`
	ArtStyle            string    `json:"artStyle"`
	MotionSpeed         float64   `json:"motionSpeed"`
	TypographyVariant   string    `json:"typographyVariant"`
	AtmosphereNote      string    `json:"atmosphereNote,omitempty"`
	Mood                string    `json:"mood,omitempty"`
	MoodLabel           string    `json:"moodLabel,omitempty"`
	CuratorSummary      string    `json:"curatorSummary,omitempty"`
	PersonalizationNote string    `json:"personalizationNote,omitempty"`
	AIGenerated         bool      `json:"aiGenerated,omitempty"`
}

// Day — одно воспоминание пользователя (с альбомом из 1–6 фотографий).
type Day struct {
	ID          string      `json:"id"`
	UserID      string      `json:"-"`
	Date        string      `json:"date"`
	FolderTitle string      `json:"folderTitle"`
	Text        string      `json:"text"`
	PhotoURI    string      `json:"photoUri"`
	PhotoURIs   []string    `json:"photoUris,omitempty"`
	Mood        string      `json:"mood,omitempty"`
	Track       TrackInfo   `json:"track"`
	Style       StyleRecipe `json:"style"`
	CreatedAt   time.Time   `json:"createdAt"`
}
