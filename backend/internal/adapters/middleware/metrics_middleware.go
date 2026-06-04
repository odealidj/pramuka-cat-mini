package middleware

import (
	"time"

	"github.com/labstack/echo/v4"
	"github.com/odealidj/pramuka-CAT/backend/pkg/tracer"
)

// MetricsMiddleware mencatat latensi HTTP request ke Prometheus via OpenTelemetry
func MetricsMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Lewati metrik untuk endpoint /health agar tidak memenuhi log metrik
			if c.Request().URL.Path == "/health" || c.Request().URL.Path == "/metrics" {
				return next(c)
			}

			start := time.Now()

			err := next(c)
			if err != nil {
				c.Error(err)
			}

			duration := time.Since(start).Seconds()
			status := c.Response().Status

			// Panggil helper metrik untuk merekam durasi (termasuk Exemplar Trace ID)
			// Context dari Echo request `c.Request().Context()` sudah mengandung Span ID dari otelecho middleware
			tracer.RecordHTTPReqDuration(c.Request().Context(), c.Request().Method, c.Path(), status, duration)

			return err
		}
	}
}
