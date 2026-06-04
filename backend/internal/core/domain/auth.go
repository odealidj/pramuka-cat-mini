package domain

import (
	"github.com/google/uuid"
)

// LoginRequest merepresentasikan data JSON yang dikirim saat login
type LoginRequest struct {
	Username string `json:"username" validate:"required" extensions:"x-order=0"`
	Password string `json:"password" validate:"required" extensions:"x-order=1"`
}

// RegisterRequest merepresentasikan data JSON yang dikirim saat peserta mendaftar
type RegisterRequest struct {
	Username string `json:"username" validate:"required"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	FullName string `json:"full_name" validate:"required"`
}

// RegisterResponse adalah balasan sukses registrasi
type RegisterResponse struct {
	User UserResponse `json:"user"`
}

// UserResponse adalah representasi data user tanpa password hash
type UserResponse struct {
	ID                 uuid.UUID `json:"id"`
	Username           string    `json:"username"`
	Email              *string   `json:"email"`
	FullName           string    `json:"full_name"`
	Role               string    `json:"role"`
	PhotoURL           *string   `json:"photo_url,omitempty"`
	EmailNotifications bool      `json:"email_notifications"`
}

// LoginResponse adalah balasan sukses login yang mengandung JWT
type LoginResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         UserResponse `json:"user"`
}

// RefreshRequest merepresentasikan payload untuk meminta access token baru
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// RefreshResponse adalah balasan sukses dari refresh token
type RefreshResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}
