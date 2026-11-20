package main

import (
	"errors"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	users   = make([]User, 0)
	usersMu sync.RWMutex
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

func registerUser(c *fiber.Ctx) error {
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

	usersMu.Lock()
	defer usersMu.Unlock()

	for _, existingUser := range users {
		if existingUser.Email == email {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "Пользователь с таким email уже существует",
			})
		}
	}

	user := User{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: string(passwordHash),
		DisplayName:  name,
		Handle:       "@" + strings.ReplaceAll(strings.ToLower(name), " ", "_"),
		Bio:          "Фиксирую свет, звук и ощущение дней.",
		CreatedAt:    time.Now().UTC(),
	}

	users = append(users, user)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"user": user,
	})
}

func loginUser(c *fiber.Ctx) error {
	var input loginRequest

	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Некорректный JSON",
		})
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))

	usersMu.RLock()
	defer usersMu.RUnlock()

	for _, user := range users {
		if user.Email != email {
			continue
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

	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"error": "Неверный email или пароль",
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
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})

	return token.SignedString([]byte(secret))
}

type updateProfileRequest struct {
	DisplayName string `json:"displayName"`
	Handle      string `json:"handle"`
	Bio         string `json:"bio"`
}

func requireAuth(c *fiber.Ctx) error {
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

	c.Locals("userID", userID)
	return c.Next()
}

func getProfile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	usersMu.RLock()
	defer usersMu.RUnlock()

	for _, user := range users {
		if user.ID == userID {
			return c.JSON(fiber.Map{
				"user": user,
			})
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error": "Пользователь не найден",
	})
}

func updateProfile(c *fiber.Ctx) error {
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

	if len(input.Bio) > 160 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Описание не должно быть длиннее 160 символов",
		})
	}

	usersMu.Lock()
	defer usersMu.Unlock()

	for index := range users {
		if users[index].ID != userID {
			continue
		}

		users[index].DisplayName = input.DisplayName
		users[index].Handle = input.Handle
		users[index].Bio = input.Bio

		return c.JSON(fiber.Map{
			"user": users[index],
		})
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error": "Пользователь не найден",
	})
}
