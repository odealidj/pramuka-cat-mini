package services_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports/mocks"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/services"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestAuthService_Login_Success(t *testing.T) {
	// Setup mocks
	mockRepo := new(mocks.AuthRepository)
	mockCache := new(mocks.AuthCache)
	authSvc := services.NewAuthService(mockRepo, mockCache)

	// Test data
	ctx := context.Background()
	req := domain.LoginRequest{
		Username: "testuser",
		Password: "Password123!",
	}
	userID := uuid.New()

	hashedPassword, _ := utils.HashPassword(req.Password)
	dbUser := sqlcgen.User{
		ID:           userID,
		Username:     req.Username,
		PasswordHash: hashedPassword,
		FullName:     "Test User",
		Role:         "peserta",
	}

	// Expectations
	mockRepo.On("GetUserByUsername", ctx, req.Username).Return(dbUser, nil)
	mockRepo.On("CreateSession", ctx, mock.AnythingOfType("sqlcgen.CreateSessionParams")).Return(sqlcgen.Session{}, nil)
	mockCache.On("SetSession", ctx, mock.AnythingOfType("uuid.UUID"), userID, 15).Return(nil)

	// Execute
	resp, err := authSvc.Login(ctx, req)

	// Assertions
	assert.NoError(t, err)
	assert.NotEmpty(t, resp.AccessToken)
	assert.NotEmpty(t, resp.RefreshToken)
	assert.Equal(t, dbUser.ID, resp.User.ID)
	assert.Equal(t, dbUser.Username, resp.User.Username)

	// Verify interactions
	mockRepo.AssertExpectations(t)
	mockCache.AssertExpectations(t)
}

func TestAuthService_Login_UserNotFound(t *testing.T) {
	mockRepo := new(mocks.AuthRepository)
	mockCache := new(mocks.AuthCache)
	authSvc := services.NewAuthService(mockRepo, mockCache)

	ctx := context.Background()
	req := domain.LoginRequest{
		Username: "unknownuser",
		Password: "Password123!",
	}

	mockRepo.On("GetUserByUsername", ctx, req.Username).Return(sqlcgen.User{}, errors.New("not found"))

	resp, err := authSvc.Login(ctx, req)

	assert.Error(t, err)
	assert.Equal(t, "username atau sandi salah", err.Error())
	assert.Empty(t, resp.AccessToken)

	mockRepo.AssertExpectations(t)
	mockCache.AssertNotCalled(t, "SetSession")
}

func TestAuthService_Refresh_Success(t *testing.T) {
	mockRepo := new(mocks.AuthRepository)
	mockCache := new(mocks.AuthCache)
	authSvc := services.NewAuthService(mockRepo, mockCache)

	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	refreshToken, _ := utils.CreateRefreshToken(sessionID)
	req := domain.RefreshRequest{
		RefreshToken: refreshToken,
	}

	dbSession := sqlcgen.Session{
		ID:           sessionID,
		UserID:       userID,
		RefreshToken: refreshToken,
		IsBlocked:    false,
		ExpiresAt:    time.Now().Add(1 * time.Hour),
	}

	dbUser := sqlcgen.User{
		ID:   userID,
		Role: "peserta",
	}

	mockRepo.On("GetSession", ctx, sessionID).Return(dbSession, nil)
	mockRepo.On("GetUserById", ctx, userID).Return(dbUser, nil)
	mockCache.On("SetSession", ctx, sessionID, userID, 15).Return(nil)

	resp, err := authSvc.Refresh(ctx, req)

	assert.NoError(t, err)
	assert.NotEmpty(t, resp.AccessToken)
	assert.Equal(t, req.RefreshToken, resp.RefreshToken)

	mockRepo.AssertExpectations(t)
	mockCache.AssertExpectations(t)
}
