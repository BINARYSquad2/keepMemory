package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	if err := godotenv.Load(); err != nil {
		log.Println("Файл .env не найден, беру системные переменные")
	}

	db, err := InitDB()
	if err != nil {
		return err
	}
	defer db.Close()
	log.Println("Успешно подключено к PostgreSQL (keepmemory)!")

	if strings.TrimSpace(os.Getenv("GEMINI_API_KEY")) != "" {
		log.Println("Gemini API настроен; вызовы требуют согласия пользователя для записи")
	} else {
		log.Println("GEMINI_API_KEY не задан: используется локальный движок анализа дня")
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}

	return newApp(db).Listen(":" + port)
}

func newApp(db *pgxpool.Pool) *fiber.App {
	app := fiber.New(fiber.Config{
		BodyLimit: 35 * 1024 * 1024,
	})
	api := &apiServer{db: db}

	allowedOrigins := configuredCORSOrigins()
	app.Use(cors.New(cors.Config{
		AllowOrigins: allowedOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PATCH, DELETE, OPTIONS",
	}))

	dir := uploadsDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("Не удалось создать папку uploads (%s): %v", dir, err)
	}

	app.Get("/health", func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSONCharsetUTF8)
		return c.JSON(fiber.Map{
			"app":       "KeepMemory",
			"status":    "ok",
			"aiEnabled": strings.TrimSpace(os.Getenv("GEMINI_API_KEY")) != "",
		})
	})
	app.Get("/health/ready", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.UserContext(), 2*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"app":    "KeepMemory",
				"status": "not_ready",
			})
		}
		probe, err := os.CreateTemp(dir, ".ready-*")
		if err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"app":    "KeepMemory",
				"status": "not_ready",
			})
		}
		probeName := probe.Name()
		if err := probe.Close(); err != nil {
			_ = os.Remove(probeName)
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"app":    "KeepMemory",
				"status": "not_ready",
			})
		}
		if err := os.Remove(probeName); err != nil {
			log.Printf("remove readiness probe file: %v", err)
		}
		return c.JSON(fiber.Map{"app": "KeepMemory", "status": "ready"})
	})

	apiRoutes := app.Group("/api", func(c *fiber.Ctx) error {
		err := c.Next()
		if c.GetRespHeader(fiber.HeaderContentType) == "" {
			c.Response().Header.SetContentType(fiber.MIMEApplicationJSONCharsetUTF8)
		}
		return err
	})

	auth := apiRoutes.Group("/auth")
	auth.Post("/register", api.registerUser)
	auth.Post("/login", api.loginUser)

	apiRoutes.Get("/profile", api.requireAuth, api.getProfile)
	apiRoutes.Patch("/profile", api.requireAuth, api.updateProfile)
	apiRoutes.Post("/days", api.requireAuth, api.createDay)
	apiRoutes.Get("/days", api.requireAuth, api.getDays)
	apiRoutes.Get("/days/:id", api.requireAuth, api.getDayByID)
	apiRoutes.Delete("/days/:id", api.requireAuth, api.deleteDay)
	apiRoutes.Get("/backup", api.requireAuth, api.downloadBackup)
	apiRoutes.Get("/tracks/search", api.requireAuth, searchTracks)
	apiRoutes.Get("/media/:owner/:filename", api.getMedia)

	return app
}

func configuredCORSOrigins() string {
	value := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if value == "" {
		return "http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006"
	}

	origins := strings.Split(value, ",")
	cleaned := make([]string, 0, len(origins))
	for _, origin := range origins {
		origin = strings.TrimSpace(origin)
		if origin == "*" {
			log.Printf("ignoring wildcard CORS origin; configure explicit trusted origins")
			continue
		}
		if origin != "" {
			cleaned = append(cleaned, origin)
		}
	}
	if len(cleaned) == 0 {
		return "http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006"
	}
	return strings.Join(cleaned, ",")
}
