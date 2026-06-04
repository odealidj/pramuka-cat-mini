package validator

import (
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

// CustomValidator merupakan bungkus (wrapper) untuk go-playground/validator/v10
type CustomValidator struct {
	validator *validator.Validate
}

// NewCustomValidator menginisialisasi validator baru
func NewCustomValidator() *CustomValidator {
	return &CustomValidator{validator: validator.New()}
}

// Validate diwajibkan oleh antarmuka Echo.Validator
func (cv *CustomValidator) Validate(i interface{}) error {
	if err := cv.validator.Struct(i); err != nil {
		// Mengembalikan HTTP 400 Bad Request jika data tidak sesuai aturan
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return nil
}
