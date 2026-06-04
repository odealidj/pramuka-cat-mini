package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
)

type UserRepository interface {
	CreateUser(ctx context.Context, u domain.User, passwordHash string) (domain.User, error)
	GetUserById(ctx context.Context, id uuid.UUID) (domain.User, error)
	GetUserPasswordHash(ctx context.Context, id uuid.UUID) (string, error)
	ListUsers(ctx context.Context, page int32, limit int32, search string) ([]domain.User, int64, error)
	ListAdmins(ctx context.Context, page int32, limit int32, search string) ([]domain.User, int64, error)
	UpdateUser(ctx context.Context, id uuid.UUID, u domain.User) (domain.User, error)
	UpdateUserPassword(ctx context.Context, id uuid.UUID, passwordHash string) error
	UpdateUserPhoto(ctx context.Context, id uuid.UUID, photoUrl string) error
	DeleteUser(ctx context.Context, id uuid.UUID) error
}

type UserService interface {
	CreateUser(ctx context.Context, req domain.CreateUserRequest) (domain.User, error)
	GetUserById(ctx context.Context, id uuid.UUID) (domain.User, error)
	ListUsers(ctx context.Context, page int32, limit int32, search string) ([]domain.User, int64, error)
	ListAdmins(ctx context.Context, page int32, limit int32, search string) ([]domain.User, int64, error)
	UpdateUser(ctx context.Context, id uuid.UUID, req domain.UpdateUserRequest) (domain.User, error)
	UpdateProfile(ctx context.Context, id uuid.UUID, req domain.UpdateProfileRequest) (domain.User, error)
	UpdateUserPassword(ctx context.Context, id uuid.UUID, req domain.UpdateUserPasswordRequest) error
	ChangePassword(ctx context.Context, id uuid.UUID, req domain.UpdateProfilePasswordRequest) error
	UpdateUserPhoto(ctx context.Context, id uuid.UUID, photoUrl string) error
	DeleteUser(ctx context.Context, id uuid.UUID) error
}
