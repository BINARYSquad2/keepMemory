package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const mediaURLLifetime = 24 * time.Hour

func mediaFilename(uri string) string {
	_, filename, _ := mediaLocation(uri)
	return filename
}

func mediaLocation(uri string) (owner, filename string, legacy bool) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", "", false
	}
	if parsed.Scheme != "" || parsed.Host != "" {
		return "", "", false
	}

	if path.Clean(parsed.Path) != parsed.Path {
		return "", "", false
	}

	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	switch {
	case len(parts) == 3 && parts[0] == "api" && parts[1] == "media":
		filename, legacy = parts[2], true
	case len(parts) == 4 && parts[0] == "api" && parts[1] == "media":
		owner, filename = parts[2], parts[3]
	case len(parts) == 2 && parts[0] == "uploads":
		filename, legacy = parts[1], true
	default:
		return "", "", false
	}

	extension := strings.ToLower(filepath.Ext(filename))
	switch extension {
	case ".jpg", ".jpeg", ".png", ".webp", ".heic":
	default:
		return "", "", false
	}
	if strings.Contains(filename, "\\") || filename == "." || filename == ".." {
		return "", "", false
	}

	return owner, filename, legacy
}

func signedMediaURI(userID, uri string) (string, error) {
	owner, filename, legacy := mediaLocation(uri)
	if filename == "" {
		return uri, nil
	}
	if !legacy && owner != "" && owner != userID {
		return "", errors.New("media owner does not match day owner")
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", errors.New("JWT_SECRET is not set")
	}

	expires := time.Now().Add(mediaURLLifetime).Unix()
	expiresText := strconv.FormatInt(expires, 10)
	signature := mediaSignature(secret, userID, filename, expiresText)
	query := url.Values{}
	query.Set("user", userID)
	query.Set("expires", expiresText)
	query.Set("signature", signature)

	return "/api/media/" + url.PathEscape(userID) + "/" + url.PathEscape(filename) + "?" + query.Encode(), nil
}

func signDayMedia(day *Day) error {
	var err error
	day.PhotoURI, err = signedMediaURI(day.UserID, day.PhotoURI)
	if err != nil {
		return err
	}

	for i, uri := range day.PhotoURIs {
		day.PhotoURIs[i], err = signedMediaURI(day.UserID, uri)
		if err != nil {
			return err
		}
	}
	return nil
}

func mediaSignature(secret, userID, filename, expires string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = fmt.Fprintf(mac, "%s\n%s\n%s", userID, filename, expires)
	return hex.EncodeToString(mac.Sum(nil))
}

func validatedPhotoExtension(file *multipart.FileHeader) (string, error) {
	stream, err := file.Open()
	if err != nil {
		return "", err
	}
	defer stream.Close()

	header := make([]byte, 512)
	n, readErr := io.ReadFull(stream, header)
	if readErr != nil && !errors.Is(readErr, io.EOF) && !errors.Is(readErr, io.ErrUnexpectedEOF) {
		return "", readErr
	}
	header = header[:n]

	switch http.DetectContentType(header) {
	case "image/jpeg":
		return ".jpg", nil
	case "image/png":
		return ".png", nil
	case "image/webp":
		return ".webp", nil
	}

	if isHEIFContainer(header) {
		return ".heic", nil
	}
	return "", errors.New("unsupported image format")
}

func isHEIFContainer(header []byte) bool {
	if len(header) < 12 || string(header[4:8]) != "ftyp" {
		return false
	}
	brand := string(header[8:12])
	switch brand {
	case "heic", "heix", "hevc", "hevx", "mif1", "msf1":
		return true
	default:
		return false
	}
}

func isOwnedUploadFilename(filename string) bool {
	extension := strings.ToLower(filepath.Ext(filename))
	if extension != ".jpg" && extension != ".jpeg" && extension != ".png" &&
		extension != ".webp" && extension != ".heic" {
		return false
	}
	_, err := uuid.Parse(strings.TrimSuffix(filename, filepath.Ext(filename)))
	return err == nil
}

func verifyMediaSignature(userID, owner, filename, expires, signature string, now time.Time) bool {
	if owner != userID {
		return false
	}
	if userID == "" || mediaFilename("/api/media/"+filename) != filename {
		return false
	}

	expiry, err := strconv.ParseInt(expires, 10, 64)
	if err != nil || expiry <= now.Unix() || expiry > now.Add(mediaURLLifetime).Unix()+60 {
		return false
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return false
	}

	expected, err := hex.DecodeString(mediaSignature(secret, userID, filename, expires))
	if err != nil {
		return false
	}
	provided, err := hex.DecodeString(signature)
	return err == nil && hmac.Equal(expected, provided)
}

func (s *apiServer) getMedia(c *fiber.Ctx) error {
	filename := c.Params("filename")
	owner := c.Params("owner")
	userID := c.Query("user")
	if !verifyMediaSignature(userID, owner, filename, c.Query("expires"), c.Query("signature"), time.Now()) {
		return c.SendStatus(fiber.StatusNotFound)
	}

	currentURI := "/api/media/" + owner + "/" + filename
	legacyURI := "/uploads/" + filename
	legacyPrivateURI := "/api/media/" + filename
	var owned bool
	err := s.db.QueryRow(c.UserContext(),
		`SELECT EXISTS (
			SELECT 1 FROM days
			WHERE user_id = $1
			  AND (
				photo_uri IN ($2, $3)
			  	OR photo_uri = $4
			  	OR photo_uris ? $2
			  	OR photo_uris ? $3
			  	OR photo_uris ? $4
			  )
		)`,
		userID,
		currentURI,
		legacyURI,
		legacyPrivateURI,
	).Scan(&owned)
	if err != nil {
		return databaseErrorResponse(c, err, "verify media ownership", "Не удалось загрузить фотографию")
	}
	if !owned {
		return c.SendStatus(fiber.StatusNotFound)
	}

	diskPath := filepath.Join(uploadsDir(), owner, filename)
	info, err := os.Stat(diskPath)
	if err != nil {
		diskPath = filepath.Join(uploadsDir(), filename)
		info, err = os.Stat(diskPath)
	}
	if err != nil || !info.Mode().IsRegular() {
		return c.SendStatus(fiber.StatusNotFound)
	}

	c.Set(fiber.HeaderCacheControl, "private, max-age=3600")
	c.Set("X-Content-Type-Options", "nosniff")
	mediaType := http.DetectContentType(nil)
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".jpg", ".jpeg":
		mediaType = "image/jpeg"
	case ".png":
		mediaType = "image/png"
	case ".webp":
		mediaType = "image/webp"
	case ".heic":
		mediaType = "image/heic"
	}
	c.Set(fiber.HeaderContentType, mediaType)
	return c.SendFile(diskPath)
}
