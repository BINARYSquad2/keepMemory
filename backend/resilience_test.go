package main

import (
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path"
	"strconv"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestDoWithRetryRetriesTemporaryResponses(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		attempts++
		if attempts < 3 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := server.Client()
	response, err := doWithRetry(context.Background(), client, func(ctx context.Context) (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, server.URL, nil)
	})
	if err != nil {
		t.Fatalf("doWithRetry returned error: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("final status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	if attempts != 3 {
		t.Fatalf("request attempts = %d, want 3", attempts)
	}
}

func TestDoWithRetryStopsAfterMaximumAttempts(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		attempts++
		w.Header().Set("Retry-After", "0")
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	response, err := doWithRetry(context.Background(), server.Client(), func(ctx context.Context) (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, server.URL, nil)
	})
	if err != nil {
		t.Fatalf("doWithRetry returned error: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("final status = %d, want %d", response.StatusCode, http.StatusServiceUnavailable)
	}
	if attempts != upstreamMaxAttempts {
		t.Fatalf("request attempts = %d, want %d", attempts, upstreamMaxAttempts)
	}
}

func TestTransientDatabaseErrorClassification(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "timeout", err: context.DeadlineExceeded, want: true},
		{name: "connection lost", err: &pgconn.PgError{Code: "08006"}, want: true},
		{name: "server starting", err: &pgconn.PgError{Code: "57P03"}, want: true},
		{name: "unique constraint", err: &pgconn.PgError{Code: "23505"}, want: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := isTransientDatabaseError(test.err); got != test.want {
				t.Fatalf("isTransientDatabaseError() = %t, want %t", got, test.want)
			}
		})
	}
}

func TestSignedMediaURIIsOwnerBoundAndExpires(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-media-signing-secret")

	userID := "owner-123"
	filename := "f1b70da1-9fed-479b-aa4a-8fe0772b3589.jpg"
	signedURI, err := signedMediaURI(userID, "/api/media/"+userID+"/"+filename)
	if err != nil {
		t.Fatalf("signedMediaURI returned error: %v", err)
	}
	parsed, err := url.Parse(signedURI)
	if err != nil {
		t.Fatalf("parse signed URI: %v", err)
	}
	if parsed.Path != "/api/media/"+userID+"/"+filename {
		t.Fatalf("signed path = %q", parsed.Path)
	}
	query := parsed.Query()
	if !verifyMediaSignature(
		query.Get("user"),
		path.Base(path.Dir(parsed.Path)),
		path.Base(parsed.Path),
		query.Get("expires"),
		query.Get("signature"),
		time.Now(),
	) {
		t.Fatal("valid signed media URL was rejected")
	}
	if verifyMediaSignature(
		"another-user",
		userID,
		filename,
		query.Get("expires"),
		query.Get("signature"),
		time.Now(),
	) {
		t.Fatal("media URL was accepted for another owner")
	}

	expired := strconv.FormatInt(time.Now().Add(-time.Second).Unix(), 10)
	expiredSignature := mediaSignature("test-media-signing-secret", userID, filename, expired)
	if verifyMediaSignature(userID, userID, filename, expired, expiredSignature, time.Now()) {
		t.Fatal("expired media URL was accepted")
	}
}

func TestFolderTitleMustContainThreeToSevenWords(t *testing.T) {
	for _, title := range []string{
		"Тихий вечер",
		"Очень длинное название этой папки содержит восемь слов",
	} {
		if validFolderTitle(title) {
			t.Errorf("validFolderTitle(%q) = true, want false", title)
		}
	}
	for _, title := range []string{
		"Тихий вечер после дождя",
		"Парк, кофе и музыка",
	} {
		if !validFolderTitle(title) {
			t.Errorf("validFolderTitle(%q) = false, want true", title)
		}
	}
}

func TestMediaLocationRejectsTraversal(t *testing.T) {
	if filename := mediaFilename("/api/media/../secret.jpg"); filename != "" {
		t.Fatalf("mediaFilename accepted traversal path %q", filename)
	}
	if filename := mediaFilename("/uploads/example.txt"); filename != "" {
		t.Fatalf("mediaFilename accepted unsupported file %q", filename)
	}
	if filename := mediaFilename("https://example.com/uploads/" + "f1b70da1-9fed-479b-aa4a-8fe0772b3589.jpg"); filename != "" {
		t.Fatalf("mediaFilename treated external URL as local file %q", filename)
	}
	owner, filename, legacy := mediaLocation("/api/media/owner-123/f1b70da1-9fed-479b-aa4a-8fe0772b3589.jpg")
	if owner != "owner-123" || filename == "" || legacy {
		t.Fatalf("mediaLocation = (%q, %q, %t), want owner-bound current URL", owner, filename, legacy)
	}
}

func TestValidatedPhotoExtensionChecksContent(t *testing.T) {
	tests := []struct {
		name    string
		content []byte
		wantExt string
		wantErr bool
	}{
		{
			name:    "jpeg",
			content: []byte{0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00},
			wantExt: ".jpg",
		},
		{name: "spoofed text", content: []byte("<html>not an image</html>"), wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			part, err := writer.CreateFormFile("photo", "photo.jpg")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := part.Write(test.content); err != nil {
				t.Fatal(err)
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}

			request := httptest.NewRequest(http.MethodPost, "/", &body)
			request.Header.Set("Content-Type", writer.FormDataContentType())
			if err := request.ParseMultipartForm(1024); err != nil {
				t.Fatal(err)
			}
			file := request.MultipartForm.File["photo"][0]
			got, err := validatedPhotoExtension(file)
			if (err != nil) != test.wantErr {
				t.Fatalf("validatedPhotoExtension error = %v, wantErr %t", err, test.wantErr)
			}
			if got != test.wantExt {
				t.Fatalf("validatedPhotoExtension = %q, want %q", got, test.wantExt)
			}
			if err := request.MultipartForm.RemoveAll(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestGeminiRequiresExplicitConsent(t *testing.T) {
	t.Setenv("GEMINI_API_KEY", "must-not-be-used")
	title, style := generateDayRecipe(
		context.Background(),
		User{},
		nil,
		"Тихий день с кофе и прогулкой по парку.",
		TrackInfo{Title: "Test", Genre: "Jazz", Energy: 0.35},
		nil,
		1,
		false,
	)
	if title == "" || style.AIGenerated {
		t.Fatalf("without consent got title %q and aiGenerated=%t", title, style.AIGenerated)
	}
}
