package main

import (
	"log"
	"os"
	"path/filepath"

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

	return newApp(db).Listen(":8080")
}

func newApp(db *pgxpool.Pool) *fiber.App {
	app := fiber.New(fiber.Config{
		BodyLimit: 20 * 1024 * 1024,
	})
	api := &apiServer{db: db}

	if err := os.MkdirAll(filepath.Join("uploads"), 0755); err != nil {
		log.Printf("Не удалось создать папку uploads: %v", err)
	}
	app.Static("/uploads", "./uploads")

	// Разрешает мобильному приложению обращаться к API во время разработки.
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	app.Use(func(c *fiber.Ctx) error {
		err := c.Next()

		// Все текущие маршруты API возвращают JSON.
		// Явно указываем UTF-8 для кириллицы.
		c.Response().Header.SetContentType(fiber.MIMEApplicationJSONCharsetUTF8)

		return err
	})

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"app":    "KeepMemory",
			"status": "ok",
		})
	})

	apiRoutes := app.Group("/api")
	auth := apiRoutes.Group("/auth")

	auth.Post("/register", api.registerUser)
	auth.Post("/login", api.loginUser)

	apiRoutes.Get("/profile", api.requireAuth, api.getProfile)
	apiRoutes.Patch("/profile", api.requireAuth, api.updateProfile)
	apiRoutes.Post("/days", api.requireAuth, api.createDay)
	apiRoutes.Get("/days", api.requireAuth, api.getDays)
	apiRoutes.Get("/days/:id", api.requireAuth, api.getDayByID)
	apiRoutes.Get("/tracks/search", api.requireAuth, searchTracks)

	return app
}
