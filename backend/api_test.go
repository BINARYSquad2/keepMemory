package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

func TestNormalizePhotoURIs(t *testing.T) {
	got := normalizePhotoURIs(" https://example.com/cover.jpg ", []string{
		"https://example.com/cover.jpg",
		" ",
		"https://example.com/detail.jpg",
		"https://example.com/detail.jpg",
	})
	want := []string{
		"https://example.com/cover.jpg",
		"https://example.com/detail.jpg",
	}

	if len(got) != len(want) {
		t.Fatalf("album length = %d, want %d (%#v)", len(got), len(want), got)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("album[%d] = %q, want %q", index, got[index], want[index])
		}
	}
}

func TestFallbackAnalyzeDayUsesMoodCuesAndTrackEnergy(t *testing.T) {
	title, rainyStyle := fallbackAnalyzeDay(
		User{},
		"Тихая прогулка после дождя",
		TrackInfo{Title: "Soft", Genre: "Ambient", Energy: 0.3},
		photoVisuals{},
		1,
	)
	if title != "Тихая прогулка после дождя" {
		t.Fatalf("rainy day title = %q, want a title based on the day details", title)
	}
	if rainyStyle.ArtStyle != "dreamy_aura" || rainyStyle.Mood != "sad" {
		t.Fatalf("rainy day style = %#v, want dreamy_aura and sad mood", rainyStyle)
	}

	_, calmStyle := fallbackAnalyzeDay(User{}, "Обычный день", TrackInfo{Energy: 0.2}, photoVisuals{}, 1)
	_, energeticStyle := fallbackAnalyzeDay(User{}, "Обычный день", TrackInfo{Energy: 0.9}, photoVisuals{}, 1)
	if energeticStyle.MotionSpeed <= calmStyle.MotionSpeed {
		t.Fatalf("energetic motion speed = %v, calm speed = %v",
			energeticStyle.MotionSpeed, calmStyle.MotionSpeed)
	}
}

func TestAuthenticatedDayWorkflow(t *testing.T) {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("load .env: %v", err)
	}
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("set DATABASE_URL or provide it in backend/.env to run the PostgreSQL integration test")
	}

	db, err := InitDB()
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(db.Close)

	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("GEMINI_API_KEY", "") // тесты не должны зависеть от внешнего ИИ API

	email := "test-" + uuid.NewString() + "@example.com"
	secondEmail := "test-" + uuid.NewString() + "@example.com"
	t.Cleanup(func() {
		_, err := db.Exec(context.Background(),
			"DELETE FROM users WHERE email = $1 OR email = $2",
			email,
			secondEmail,
		)
		if err != nil {
			t.Errorf("clean up test users: %v", err)
		}
	})

	app := newApp(db)
	register := performJSONRequest(t, app, http.MethodPost, "/api/auth/register", "", map[string]string{
		"name":     "Test User",
		"email":    email,
		"password": "password123",
	})
	if register.Code != http.StatusCreated {
		t.Fatalf("register status = %d, want %d: %s", register.Code, http.StatusCreated, register.Body)
	}

	var auth struct {
		Token string `json:"token"`
		User  User   `json:"user"`
	}
	if err := json.Unmarshal(register.Body.Bytes(), &auth); err != nil {
		t.Fatalf("decode register response: %v", err)
	}
	if auth.Token == "" || auth.User.ID == "" {
		t.Fatal("register response must include an auth token and user")
	}

	staleToken, err := createToken(User{ID: uuid.NewString()})
	if err != nil {
		t.Fatalf("create token for missing user: %v", err)
	}
	staleUserRequest := performJSONRequest(t, app, http.MethodPost, "/api/days", staleToken, nil)
	if staleUserRequest.Code != http.StatusUnauthorized {
		t.Fatalf("request with token for missing user status = %d, want %d: %s",
			staleUserRequest.Code, http.StatusUnauthorized, staleUserRequest.Body)
	}

	login := performJSONRequest(t, app, http.MethodPost, "/api/auth/login", "", map[string]string{
		"email":    email,
		"password": "password123",
	})
	if login.Code != http.StatusOK {
		t.Fatalf("login status = %d, want %d: %s", login.Code, http.StatusOK, login.Body)
	}

	profile := performJSONRequest(t, app, http.MethodGet, "/api/profile", auth.Token, nil)
	if profile.Code != http.StatusOK {
		t.Fatalf("profile status = %d, want %d: %s", profile.Code, http.StatusOK, profile.Body)
	}

	updatedProfile := performJSONRequest(t, app, http.MethodPatch, "/api/profile", auth.Token, map[string]string{
		"displayName": "Updated User",
		"handle":      "@updated_user",
		"bio":         "Люблю плёночную фотографию, прогулки после дождя и спокойный джаз по вечерам.",
	})
	if updatedProfile.Code != http.StatusOK {
		t.Fatalf("update profile status = %d, want %d: %s", updatedProfile.Code, http.StatusOK, updatedProfile.Body)
	}
	persistedProfile := performJSONRequest(t, app, http.MethodGet, "/api/profile", auth.Token, nil)
	if persistedProfile.Code != http.StatusOK {
		t.Fatalf("get updated profile status = %d, want %d: %s", persistedProfile.Code, http.StatusOK, persistedProfile.Body)
	}
	var persistedUser struct {
		User User `json:"user"`
	}
	if err := json.Unmarshal(persistedProfile.Body.Bytes(), &persistedUser); err != nil {
		t.Fatalf("decode updated profile: %v", err)
	}
	if persistedUser.User.DisplayName != "Updated User" || persistedUser.User.Handle != "@updated_user" {
		t.Fatalf("persisted profile = %#v, want updated profile", persistedUser.User)
	}

	create := performJSONRequest(t, app, http.MethodPost, "/api/days", auth.Token, map[string]interface{}{
		"text":      "Тихая прогулка под вечерним дождём с тёплым кофе",
		"photoUri":  "https://example.com/test-1.jpg",
		"photoUris": []string{"https://example.com/test-1.jpg", "https://example.com/test-2.jpg"},
		"track": TrackInfo{
			ID:         123,
			Title:      "Test Track",
			Artist:     "Test Artist",
			PreviewURL: "https://example.com/preview.mp3",
			Genre:      "Jazz",
			ArtworkURL: "https://example.com/artwork.jpg",
			TrackURL:   "https://example.com/track",
			Energy:     0.35,
		},
	})
	if create.Code != http.StatusCreated {
		t.Fatalf("create day status = %d, want %d: %s", create.Code, http.StatusCreated, create.Body)
	}

	var created struct {
		Day Day `json:"day"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created day: %v", err)
	}
	if created.Day.ID == "" || created.Day.FolderTitle == "" {
		t.Fatal("created day must include an ID and generated folder title")
	}
	createdDays := []Day{created.Day}
	if len(created.Day.PhotoURIs) != 2 {
		t.Fatalf("photoUris count = %d, want 2", len(created.Day.PhotoURIs))
	}
	if created.Day.Mood == "" {
		t.Fatal("created day must include a classified mood")
	}

	list := performJSONRequest(t, app, http.MethodGet, "/api/days", auth.Token, nil)
	if list.Code != http.StatusOK {
		t.Fatalf("list days status = %d, want %d: %s", list.Code, http.StatusOK, list.Body)
	}

	var listed struct {
		Days []Day `json:"days"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &listed); err != nil {
		t.Fatalf("decode days response: %v", err)
	}
	if len(listed.Days) != len(createdDays) {
		t.Fatalf("listed %d days, want %d", len(listed.Days), len(createdDays))
	}
	listedIDs := make(map[string]bool, len(listed.Days))
	for _, day := range listed.Days {
		listedIDs[day.ID] = true
	}
	for _, day := range createdDays {
		if !listedIDs[day.ID] {
			t.Fatalf("archive does not contain created day %s", day.ID)
		}
	}

	filtered := performJSONRequest(t, app, http.MethodGet, "/api/days?mood="+created.Day.Mood+"&q=кофе", auth.Token, nil)
	if filtered.Code != http.StatusOK {
		t.Fatalf("filtered days status = %d, want %d: %s", filtered.Code, http.StatusOK, filtered.Body)
	}
	var filteredResp struct {
		Days []Day `json:"days"`
	}
	if err := json.Unmarshal(filtered.Body.Bytes(), &filteredResp); err != nil {
		t.Fatalf("decode filtered days: %v", err)
	}
	if len(filteredResp.Days) != 1 {
		t.Fatalf("filtered days count = %d, want 1", len(filteredResp.Days))
	}

	detail := performJSONRequest(t, app, http.MethodGet, "/api/days/"+created.Day.ID, auth.Token, nil)
	if detail.Code != http.StatusOK {
		t.Fatalf("get day status = %d, want %d: %s", detail.Code, http.StatusOK, detail.Body)
	}

	secondUser := performJSONRequest(t, app, http.MethodPost, "/api/auth/register", "", map[string]string{
		"name":     "Second User",
		"email":    secondEmail,
		"password": "password123",
	})
	if secondUser.Code != http.StatusCreated {
		t.Fatalf("second register status = %d, want %d: %s", secondUser.Code, http.StatusCreated, secondUser.Body)
	}
	var secondAuth struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(secondUser.Body.Bytes(), &secondAuth); err != nil {
		t.Fatalf("decode second register response: %v", err)
	}

	privateDay := performJSONRequest(t, app, http.MethodGet, "/api/days/"+createdDays[0].ID, secondAuth.Token, nil)
	if privateDay.Code != http.StatusNotFound {
		t.Fatalf("other user's day status = %d, want %d", privateDay.Code, http.StatusNotFound)
	}

	unauthorizedList := performJSONRequest(t, app, http.MethodGet, "/api/days", "", nil)
	if unauthorizedList.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized list status = %d, want %d", unauthorizedList.Code, http.StatusUnauthorized)
	}
}

func performJSONRequest(
	t *testing.T,
	app interface {
		Test(*http.Request, ...int) (*http.Response, error)
	},
	method string,
	path string,
	token string,
	body interface{},
) *httptest.ResponseRecorder {
	t.Helper()

	var requestBody bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&requestBody).Encode(body); err != nil {
			t.Fatalf("encode request body: %v", err)
		}
	}

	request := httptest.NewRequest(method, path, &requestBody)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	}

	response, err := app.Test(request)
	if err != nil {
		t.Fatalf("perform %s %s: %v", method, path, err)
	}
	defer response.Body.Close()

	recorder := httptest.NewRecorder()
	if _, err := recorder.Body.ReadFrom(response.Body); err != nil {
		t.Fatalf("read %s %s response: %v", method, path, err)
	}
	recorder.Code = response.StatusCode
	return recorder
}
