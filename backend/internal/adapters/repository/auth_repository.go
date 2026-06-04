package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
)

type authRepository struct {
	queries *sqlcgen.Queries
}

// NewAuthRepository membungkus pemanggilan query SQLC (Outbound Adapter) agar sesuai dengan interface ports.AuthRepository
func NewAuthRepository(queries *sqlcgen.Queries) ports.AuthRepository {
	return &authRepository{
		queries: queries,
	}
}

func (r *authRepository) GetUserByUsername(ctx context.Context, username string) (sqlcgen.User, error) {
	return r.queries.GetUserByUsername(ctx, username)
}

func (r *authRepository) GetUserById(ctx context.Context, id uuid.UUID) (sqlcgen.User, error) {
	return r.queries.GetUserById(ctx, id)
}

func (r *authRepository) CreateSession(ctx context.Context, arg sqlcgen.CreateSessionParams) (sqlcgen.Session, error) {
	return r.queries.CreateSession(ctx, arg)
}

func (r *authRepository) GetSession(ctx context.Context, id uuid.UUID) (sqlcgen.Session, error) {
	return r.queries.GetSession(ctx, id)
}

func (r *authRepository) BlockSession(ctx context.Context, id uuid.UUID) error {
	return r.queries.BlockSession(ctx, id)
}

func (r *authRepository) CreateUser(ctx context.Context, arg sqlcgen.CreateUserParams) (sqlcgen.User, error) {
	return r.queries.CreateUser(ctx, arg)
}
