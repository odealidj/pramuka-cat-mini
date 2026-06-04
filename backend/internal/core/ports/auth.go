package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
)

// AuthRepository mendefinisikan kontrak interaksi dengan database utama (PostgreSQL)
type AuthRepository interface {
	GetUserByUsername(ctx context.Context, username string) (sqlcgen.User, error)
	GetUserById(ctx context.Context, id uuid.UUID) (sqlcgen.User, error)
	CreateSession(ctx context.Context, arg sqlcgen.CreateSessionParams) (sqlcgen.Session, error)
	GetSession(ctx context.Context, id uuid.UUID) (sqlcgen.Session, error)
	BlockSession(ctx context.Context, id uuid.UUID) error
	CreateUser(ctx context.Context, arg sqlcgen.CreateUserParams) (sqlcgen.User, error)
}

// AuthCache mendefinisikan kontrak interaksi dengan cache in-memory (Redis)
type AuthCache interface {
	SetSession(ctx context.Context, sessionID uuid.UUID, userID uuid.UUID, durationMinutes int) error
	GetSession(ctx context.Context, sessionID uuid.UUID) (string, error)
	DeleteSession(ctx context.Context, sessionID uuid.UUID) error
}

// AuthService mendefinisikan layanan (usecase) Autentikasi utama untuk di-_inject_ ke Handler HTTP
type AuthService interface {
	Login(ctx context.Context, req domain.LoginRequest) (domain.LoginResponse, error)
	Refresh(ctx context.Context, req domain.RefreshRequest) (domain.RefreshResponse, error)
	Logout(ctx context.Context, sessionID uuid.UUID) error
	Register(ctx context.Context, req domain.RegisterRequest) (domain.RegisterResponse, error)
}
