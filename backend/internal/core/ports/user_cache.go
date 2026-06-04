package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
)

type UserCache interface {
	CacheUserProfile(ctx context.Context, id uuid.UUID, user domain.User) error
	GetCachedUserProfile(ctx context.Context, id uuid.UUID) (*domain.User, error)
	DeleteCachedUserProfile(ctx context.Context, id uuid.UUID) error
}
