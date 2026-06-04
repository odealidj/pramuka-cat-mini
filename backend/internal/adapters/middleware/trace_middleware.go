package middleware

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// TraceErrorMiddleware melakukan dua hal sekaligus:
//
//  1. Menyisipkan Trace ID ke response header `X-Trace-Id` pada SETIAP request,
//     sehingga client/frontend dapat melaporkan trace ID saat ada masalah
//     dan tim backend dapat langsung mencarinya di Jaeger UI.
//
//  2. Menandai span sebagai Error untuk semua response HTTP >= 400 (4xx dan 5xx).
//     Secara default, otelecho hanya menandai 5xx sebagai Error
//     mengikuti konvensi semantik OTEL (4xx = kesalahan klien, bukan server).
func TraceErrorMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Jalankan handler berikutnya
			handlerErr := next(c)

			span := trace.SpanFromContext(c.Request().Context())

			// --- 1. Sisipkan Trace ID ke response header ---
			if span.SpanContext().IsValid() {
				traceID := span.SpanContext().TraceID().String()
				c.Response().Header().Set("X-Trace-Id", traceID)
			}

			// --- 2. Tentukan status code aktual ---
			statusCode := c.Response().Status

			// Jika handler mengembalikan error echo (misal: echo.NewHTTPError),
			// ambil status code dari error tersebut
			if handlerErr != nil {
				if he, ok := handlerErr.(*echo.HTTPError); ok {
					statusCode = he.Code
				} else {
					statusCode = http.StatusInternalServerError
				}
			}

			// --- 3. Tandai span sebagai Error untuk response >= 400 ---
			if statusCode >= http.StatusBadRequest {
				span.SetStatus(
					codes.Error,
					fmt.Sprintf("HTTP %d: %s", statusCode, http.StatusText(statusCode)),
				)
			}

			return handlerErr
		}
	}
}
