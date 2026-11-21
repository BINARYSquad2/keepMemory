package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
)

func databaseErrorResponse(c *fiber.Ctx, err error, operation, message string) error {
	log.Printf("%s: %v", operation, err)
	status := fiber.StatusInternalServerError
	if isTransientDatabaseError(err) {
		status = fiber.StatusServiceUnavailable
		c.Set(fiber.HeaderRetryAfter, "1")
	}
	return c.Status(status).JSON(fiber.Map{"error": message})
}

func isTransientDatabaseError(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) ||
		errors.Is(err, io.EOF) {
		return true
	}

	var connectErr *pgconn.ConnectError
	if errors.As(err, &connectErr) {
		return true
	}
	var networkErr net.Error
	if errors.As(err, &networkErr) {
		return true
	}
	var postgresErr *pgconn.PgError
	if errors.As(err, &postgresErr) {
		return strings.HasPrefix(postgresErr.Code, "08") ||
			strings.HasPrefix(postgresErr.Code, "57P") ||
			postgresErr.Code == "53300"
	}
	return false
}
