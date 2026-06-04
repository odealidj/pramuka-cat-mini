package utils

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

// HashPassword mengenkripsi string password mentah menjadi hash bcrypt
func HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("gagal hash password: %w", err)
	}
	return string(hashedPassword), nil
}

// CheckPassword mencocokkan password mentah dengan hash bcrypt
func CheckPassword(password string, hashedPassword string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
}
