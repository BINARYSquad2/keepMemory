package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const upstreamMaxAttempts = 3

type upstreamStatusError struct {
	StatusCode int
}

type upstreamTransportError struct {
	Err error
}

func (e upstreamTransportError) Error() string {
	return "upstream request failed after retries: " + e.Err.Error()
}

func (e upstreamTransportError) Unwrap() error {
	return e.Err
}

func (e upstreamStatusError) Error() string {
	return "upstream returned HTTP " + strconv.Itoa(e.StatusCode)
}

func doWithRetry(
	ctx context.Context,
	client *http.Client,
	buildRequest func(context.Context) (*http.Request, error),
) (*http.Response, error) {
	var lastErr error
	for attempt := 0; attempt < upstreamMaxAttempts; attempt++ {
		request, err := buildRequest(ctx)
		if err != nil {
			return nil, err
		}

		response, err := client.Do(request)
		if err == nil && !retryableUpstreamStatus(response.StatusCode) {
			return response, nil
		}
		if err == nil && attempt == upstreamMaxAttempts-1 {
			return response, nil
		}
		if err == nil {
			lastErr = upstreamStatusError{StatusCode: response.StatusCode}
			delay := retryDelay(response, attempt)
			_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64*1024))
			_ = response.Body.Close()
			if err := waitContext(ctx, delay); err != nil {
				return nil, err
			}
			continue
		}

		lastErr = err
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if attempt == upstreamMaxAttempts-1 {
			break
		}
		if err := waitContext(ctx, time.Duration(250*(1<<attempt))*time.Millisecond); err != nil {
			return nil, err
		}
	}

	if lastErr != nil {
		return nil, upstreamTransportError{Err: lastErr}
	}
	return nil, errors.New("upstream request failed")
}

func retryDelay(response *http.Response, attempt int) time.Duration {
	delay := time.Duration(250*(1<<attempt)) * time.Millisecond
	if response == nil {
		return delay
	}

	value := strings.TrimSpace(response.Header.Get("Retry-After"))
	if seconds, err := strconv.Atoi(value); err == nil && seconds >= 0 {
		delay = time.Duration(seconds) * time.Second
	} else if retryAt, err := http.ParseTime(value); err == nil {
		delay = time.Until(retryAt)
	}
	if delay < 0 {
		return 0
	}
	if delay > 2*time.Second {
		return 2 * time.Second
	}
	return delay
}

func waitContext(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return ctx.Err()
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func isTransientUpstreamError(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return true
	}
	var statusErr upstreamStatusError
	if errors.As(err, &statusErr) {
		return retryableUpstreamStatus(statusErr.StatusCode)
	}
	var transportErr upstreamTransportError
	return errors.As(err, &transportErr)
}

func retryableUpstreamStatus(status int) bool {
	switch status {
	case http.StatusRequestTimeout, http.StatusTooManyRequests, http.StatusInternalServerError,
		http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return true
	default:
		return false
	}
}
