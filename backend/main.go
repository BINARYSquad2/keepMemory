package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	app := fiber.New()

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

	api := app.Group("/api")
	auth := api.Group("/auth")

	auth.Post("/register", registerUser)
	auth.Post("/login", loginUser)

	api.Get("/profile", requireAuth, getProfile)
	api.Patch("/profile", requireAuth, updateProfile)
	api.Post("/days", requireAuth, createDay)
	api.Get("/days", requireAuth, getDays)
	api.Get("/tracks/search", requireAuth, searchTracks)

	log.Fatal(app.Listen(":8080"))
}
