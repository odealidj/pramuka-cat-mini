package response

import (
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"go.opentelemetry.io/otel/trace"
)

// ContextKeyTraceID adalah key untuk menyimpan Trace ID di echo context
const ContextKeyTraceID = "trace_id"

type Meta struct {
	Page         int   `json:"page"`
	Limit        int   `json:"limit"`
	TotalRecords int64 `json:"total_records"`
	TotalPages   int   `json:"total_pages"`
	HasNext      bool  `json:"has_next"`
	HasPrev      bool  `json:"has_prev"`
}

type ErrorDetail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// SuccessResponse format JSON standar untuk response sukses tanpa paginasi
type SuccessResponse struct {
	Success   bool        `json:"success" example:"true"`
	Code      int         `json:"code" example:"200"`
	Message   string      `json:"message" example:"Operasi berhasil"`
	Data      interface{} `json:"data"`
	Timestamp string      `json:"timestamp" example:"2026-05-18T02:00:00Z"`
	TraceID   string      `json:"trace_id,omitempty" example:"ed462bd023ff76e0001482c0e045e906"`
}

// ErrorResponse format JSON standar untuk response error
type ErrorResponse struct {
	Success   bool          `json:"success" example:"false"`
	Code      int           `json:"code" example:"400"`
	Message   string        `json:"message" example:"Terjadi kesalahan"`
	Errors    []ErrorDetail `json:"errors"`
	Timestamp string        `json:"timestamp" example:"2026-05-18T02:00:00Z"`
	TraceID   string        `json:"trace_id,omitempty" example:"ed462bd023ff76e0001482c0e045e906"`
}

// PaginatedResponse format JSON standar untuk response berisi koleksi + meta paginasi
type PaginatedResponse struct {
	Success   bool        `json:"success" example:"true"`
	Code      int         `json:"code" example:"200"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data"`
	Meta      *Meta       `json:"meta"`
	Timestamp string      `json:"timestamp" example:"2026-05-18T02:00:00Z"`
	TraceID   string      `json:"trace_id,omitempty" example:"ed462bd023ff76e0001482c0e045e906"`
}

type BaseResponse struct {
	Success   bool          `json:"success"`
	Code      int           `json:"code"`
	Message   string        `json:"message"`
	Data      interface{}   `json:"data"`
	Meta      *Meta         `json:"meta"`
	Errors    []ErrorDetail `json:"errors"`
	Timestamp string        `json:"timestamp"`
	TraceID   string        `json:"trace_id,omitempty"`
}

// extractTraceID mengambil Trace ID dari span aktif di context request
func extractTraceID(c echo.Context) string {
	span := trace.SpanFromContext(c.Request().Context())
	if span.SpanContext().IsValid() {
		return span.SpanContext().TraceID().String()
	}
	return ""
}

func Success(c echo.Context, statusCode int, message string, data interface{}) error {
	return c.JSON(statusCode, BaseResponse{
		Success:   true,
		Code:      statusCode,
		Message:   message,
		Data:      data,
		Meta:      nil,
		Errors:    nil,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		TraceID:   extractTraceID(c),
	})
}

func SuccessWithMeta(c echo.Context, statusCode int, message string, data interface{}, meta Meta) error {
	return c.JSON(statusCode, BaseResponse{
		Success:   true,
		Code:      statusCode,
		Message:   message,
		Data:      data,
		Meta:      &meta,
		Errors:    nil,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		TraceID:   extractTraceID(c),
	})
}

func Error(c echo.Context, statusCode int, message string, errors []ErrorDetail) error {
	return c.JSON(statusCode, BaseResponse{
		Success:   false,
		Code:      statusCode,
		Message:   message,
		Data:      nil,
		Meta:      nil,
		Errors:    errors,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		TraceID:   extractTraceID(c),
	})
}

// Helper to parse page and limit
func ParsePaginationParams(c echo.Context) (int32, int32) {
	pageStr := c.QueryParam("page")
	limitStr := c.QueryParam("limit")

	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}

	limit := 10
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	return int32(page), int32(limit)
}

// Helper to build meta
func BuildMeta(page int32, limit int32, totalRecords int64) Meta {
	totalPages := int((totalRecords + int64(limit) - 1) / int64(limit))
	hasNext := int(page) < totalPages
	hasPrev := page > 1

	return Meta{
		Page:         int(page),
		Limit:        int(limit),
		TotalRecords: totalRecords,
		TotalPages:   totalPages,
		HasNext:      hasNext,
		HasPrev:      hasPrev,
	}
}
