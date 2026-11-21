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
		"bio":         "A new bio",
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
		"text":     "A quiet walk after the rain",
		"photoUri": "file:///test/photo.jpg",
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
	if len(listed.Days) != 1 || listed.Days[0].ID != created.Day.ID {
		t.Fatalf("listed days = %#v, want the created day", listed.Days)
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

	privateDay := performJSONRequest(t, app, http.MethodGet, "/api/days/"+created.Day.ID, secondAuth.Token, nil)
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
