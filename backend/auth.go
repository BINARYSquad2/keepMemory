package main

import (
	"errors"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *apiServer) registerUser(c *fiber.Ctx) error {
	var input registerRequest

	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Некорректный JSON",
		})
	}

	name := strings.TrimSpace(input.Name)
	email := strings.ToLower(strings.TrimSpace(input.Email))

	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Имя обязательно",
		})
	}

	if !strings.Contains(email, "@") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Введите корректный email",
		})
	}

	if len(input.Password) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Пароль должен содержать минимум 8 символов",
		})
	}

	passwordHash, err := bcrypt.GenerateFromPassword(
		[]byte(input.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось защитить пароль",
		})
	}

	user := User{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: string(passwordHash),
		DisplayName:  name,
		Handle:       "@" + strings.ReplaceAll(strings.ToLower(name), " ", "_"),
		Bio:          "",
	}

	token, err := createToken(user)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось создать токен",
		})
	}

	err = s.db.QueryRow(c.UserContext(),
		`INSERT INTO users (id, name, handle, bio, email, password_hash)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING created_at`,
		user.ID,
		user.DisplayName,
		user.Handle,
		user.Bio,
		user.Email,
		user.PasswordHash,
	).Scan(&user.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "Пользователь с таким email уже существует",
			})
		}
		return databaseErrorResponse(c, err, "register user in PostgreSQL", "Не удалось сохранить пользователя")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"token":     token,
		"tokenType": "Bearer",
		"user":      user,
	})
}

func (s *apiServer) loginUser(c *fiber.Ctx) error {
	var input loginRequest

	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Некорректный JSON",
		})
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))

	var user User
	err := s.db.QueryRow(c.UserContext(),
		`SELECT id, email, password_hash, name, handle, bio, created_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.DisplayName,
		&user.Handle,
		&user.Bio,
		&user.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Неверный email или пароль",
		})
	}
	if err != nil {
		return databaseErrorResponse(c, err, "load user for login from PostgreSQL", "Не удалось выполнить вход")
	}

	if err := bcrypt.CompareHashAndPassword(
		[]byte(user.PasswordHash),
		[]byte(input.Password),
	); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Неверный email или пароль",
		})
	}

	token, err := createToken(user)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось создать токен",
		})
	}

	return c.JSON(fiber.Map{
		"token":     token,
		"tokenType": "Bearer",
		"user":      user,
	})
}

func createToken(user User) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", errors.New("JWT_SECRET is not set")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"exp":   time.Now().Add(7 * 24 * time.Hour).Unix(),
	})

	return token.SignedString([]byte(secret))
}

type updateProfileRequest struct {
	DisplayName string `json:"displayName"`
	Handle      string `json:"handle"`
	Bio         string `json:"bio"`
}

func (s *apiServer) requireAuth(c *fiber.Ctx) error {
	authHeader := c.Get(fiber.HeaderAuthorization)
	parts := strings.SplitN(authHeader, " ", 2)

	if len(parts) != 2 || parts[0] != "Bearer" || parts[1] == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Требуется токен авторизации",
		})
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "JWT_SECRET не задан",
		})
	}

	token, err := jwt.Parse(parts[1], func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("неподдерживаемый алгоритм токена")
		}

		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Недействительный или просроченный токен",
		})
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Некорректный токен",
		})
	}

	userID, ok := claims["sub"].(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "В токене нет пользователя",
		})
	}

	var userExists bool
	if err := s.db.QueryRow(c.UserContext(),
		`SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)`,
		userID,
	).Scan(&userExists); err != nil {
		log.Printf("verify authenticated user in PostgreSQL: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Не удалось проверить пользователя",
		})
	}
	if !userExists {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Пользователь не найден. Войдите в аккаунт снова",
		})
	}

	c.Locals("userID", userID)
	return c.Next()
}

func (s *apiServer) getProfile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var user User
	err := s.db.QueryRow(c.UserContext(),
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
	if errors.Is(err, pgx.ErrNoRows) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Пользователь не найден",
		})
	}
	if err != nil {
		return databaseErrorResponse(c, err, "load profile from PostgreSQL", "Не удалось загрузить профиль")
	}

	return c.JSON(fiber.Map{
		"user": user,
	})
}

func (s *apiServer) updateProfile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var input updateProfileRequest
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Некорректный JSON",
		})
	}

	input.DisplayName = strings.TrimSpace(input.DisplayName)
	input.Handle = strings.TrimSpace(input.Handle)
	input.Bio = strings.TrimSpace(input.Bio)

	if input.DisplayName == "" || input.Handle == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Имя и никнейм обязательны",
		})
	}

	if !strings.HasPrefix(input.Handle, "@") {
		input.Handle = "@" + input.Handle
	}

	if utf8.RuneCountInString(input.Bio) > 500 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Описание не должно быть длиннее 500 символов",
		})
	}

	var user User
	err := s.db.QueryRow(c.UserContext(),
		`UPDATE users
		 SET name = $1, handle = $2, bio = $3
		 WHERE id = $4
		 RETURNING id, email, name, handle, bio, created_at`,
		input.DisplayName,
		input.Handle,
		input.Bio,
		userID,
	).Scan(
		&user.ID,
		&user.Email,
		&user.DisplayName,
		&user.Handle,
		&user.Bio,
		&user.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Пользователь не найден",
		})
	}
	if err != nil {
		return databaseErrorResponse(c, err, "update profile in PostgreSQL", "Не удалось сохранить профиль")
	}

	return c.JSON(fiber.Map{
		"user": user,
	})
}
