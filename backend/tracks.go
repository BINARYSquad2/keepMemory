package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type TrackSearchResult struct {
	ID         int64   `json:"id"`
	Title      string  `json:"title"`
	Artist     string  `json:"artist"`
	PreviewURL string  `json:"previewUrl"`
	Genre      string  `json:"genre"`
	ArtworkURL string  `json:"artworkUrl"`
	TrackURL   string  `json:"trackUrl"`
	Energy     float64 `json:"energy"`
}

type iTunesSearchResponse struct {
	Results []struct {
		TrackID          int64  `json:"trackId"`
		TrackName        string `json:"trackName"`
		ArtistName       string `json:"artistName"`
		PreviewURL       string `json:"previewUrl"`
		PrimaryGenreName string `json:"primaryGenreName"`
		ArtworkURL100    string `json:"artworkUrl100"`
		TrackViewURL     string `json:"trackViewUrl"`
	} `json:"results"`
}

func searchTracks(c *fiber.Ctx) error {
	query := strings.TrimSpace(c.Query("q"))

	queryLength := len([]rune(query))
	if queryLength < 2 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Введите минимум два символа для поиска",
		})
	}
	if queryLength > 200 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Запрос поиска не должен быть длиннее 200 символов",
		})
	}

	ctx, cancel := context.WithTimeout(c.UserContext(), 18*time.Second)
	defer cancel()
	tracks, err := searchITunes(ctx, query)
	if err != nil {
		if isTransientUpstreamError(err) {
			c.Set(fiber.HeaderRetryAfter, "2")
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "Сервис поиска музыки временно недоступен. Попробуйте ещё раз.",
			})
		}
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": "Не удалось получить результаты поиска музыки",
		})
	}

	return c.JSON(fiber.Map{
		"tracks": tracks,
	})
}

func searchITunes(ctx context.Context, query string) ([]TrackSearchResult, error) {
	params := url.Values{}
	params.Set("term", query)
	params.Set("country", "US")
	params.Set("media", "music")
	params.Set("entity", "song")
	params.Set("limit", "10")

	requestURL := "https://itunes.apple.com/search?" + params.Encode()

	client := &http.Client{
		Timeout: 8 * time.Second,
	}

	response, err := doWithRetry(ctx, client, func(requestCtx context.Context) (*http.Request, error) {
		return http.NewRequestWithContext(requestCtx, http.MethodGet, requestURL, nil)
	})
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, upstreamStatusError{StatusCode: response.StatusCode}
	}

	var payload iTunesSearchResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}

	tracks := make([]TrackSearchResult, 0)

	for _, result := range payload.Results {
		if result.PreviewURL == "" {
			continue
		}

		tracks = append(tracks, TrackSearchResult{
			ID:         result.TrackID,
			Title:      result.TrackName,
			Artist:     result.ArtistName,
			PreviewURL: result.PreviewURL,
			Genre:      result.PrimaryGenreName,
			ArtworkURL: result.ArtworkURL100,
			TrackURL:   result.TrackViewURL,
			Energy:     energyByGenre(result.PrimaryGenreName),
		})
	}

	return tracks, nil
}

func energyByGenre(genre string) float64 {
	genre = strings.ToLower(genre)

	switch {
	case strings.Contains(genre, "electronic"),
		strings.Contains(genre, "hip-hop"),
		strings.Contains(genre, "rock"),
		strings.Contains(genre, "metal"):
		return 0.85

	case strings.Contains(genre, "jazz"),
		strings.Contains(genre, "ambient"),
		strings.Contains(genre, "classical"),
		strings.Contains(genre, "folk"):
		return 0.35

	default:
		return 0.55
	}
}
