package domain

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID        uuid.UUID `json:"id"`
	Username  string    `json:"username"`
	Email     *string   `json:"email"`
	FullName  string    `json:"full_name"`
	Role      string    `json:"role"`
	PhotoURL           *string   `json:"photo_url,omitempty"`
	EmailNotifications bool      `json:"email_notifications"`
	CreatedAt          time.Time `json:"created_at"`
}

type CreateUserRequest struct {
	Username string  `json:"username" validate:"required"`
	Email    string  `json:"email" validate:"required,email"`
	Password string  `json:"password" validate:"required,min=6"`
	FullName string  `json:"full_name" validate:"required"`
	Role     string  `json:"role" validate:"required,oneof=admin peserta"`
	PhotoURL *string `json:"photo_url,omitempty"`
}

type UpdateUserRequest struct {
	Username string  `json:"username" validate:"required"`
	Email    string  `json:"email" validate:"required,email"`
	FullName string  `json:"full_name" validate:"required"`
	Role     string  `json:"role" validate:"required,oneof=super_admin admin peserta"`
	PhotoURL *string `json:"photo_url,omitempty"`
}

type UpdateProfileRequest struct {
	Username           string `json:"username" validate:"required"`
	Email              string `json:"email" validate:"required,email"`
	FullName           string `json:"full_name" validate:"required"`
	EmailNotifications bool   `json:"email_notifications"`
}

type UpdateProfilePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=6"`
}

type UpdateUserPasswordRequest struct {
	Password string `json:"password" validate:"required,min=6"`
}
