package utils

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type TokenPayload struct {
	SessionID uuid.UUID
	UserID    uuid.UUID
	Role      string
}

// CreateAccessToken membuat JWT berumur pendek untuk divalidasi ke Redis
func CreateAccessToken(payload TokenPayload) (string, error) {
	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "default-secret-jangan-dipakai-di-production"
	}

	claims := jwt.MapClaims{
		"session_id": payload.SessionID.String(),
		"user_id":    payload.UserID.String(),
		"role":       payload.Role,
		"exp":        time.Now().Add(15 * time.Minute).Unix(),
		"iat":        time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secretKey))
}

// CreateRefreshToken meracik token berumur panjang untuk disimpan ke Postgres
func CreateRefreshToken(sessionID uuid.UUID) (string, error) {
	secretKey := os.Getenv("JWT_REFRESH_SECRET")
	if secretKey == "" {
		secretKey = "default-refresh-secret-jangan-dipakai"
	}

	claims := jwt.MapClaims{
		"session_id": sessionID.String(),
		"exp":        time.Now().Add(7 * 24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secretKey))
}

// ValidateToken memverifikasi JWT dan mengembalikan payload jika valid
func ValidateToken(tokenString string, isRefresh bool) (*TokenPayload, error) {
	secretKey := os.Getenv("JWT_SECRET")
	if isRefresh {
		secretKey = os.Getenv("JWT_REFRESH_SECRET")
	}
	if secretKey == "" && !isRefresh {
		secretKey = "default-secret-jangan-dipakai-di-production"
	}
	if secretKey == "" && isRefresh {
		secretKey = "default-refresh-secret-jangan-dipakai"
	}

	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metode penandatanganan tidak valid")
		}
		return []byte(secretKey), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		sessionIDStr, ok := claims["session_id"].(string)
		if !ok {
			return nil, fmt.Errorf("payload session_id tidak valid")
		}

		sessionID, err := uuid.Parse(sessionIDStr)
		if err != nil {
			return nil, fmt.Errorf("format session_id salah")
		}

		payload := &TokenPayload{
			SessionID: sessionID,
		}

		if !isRefresh {
			// Access token memiliki user_id dan role
			userIDStr, _ := claims["user_id"].(string)
			userID, _ := uuid.Parse(userIDStr)
			role, _ := claims["role"].(string)

			payload.UserID = userID
			payload.Role = role
		}

		return payload, nil
	}

	return nil, fmt.Errorf("token tidak valid")
}
