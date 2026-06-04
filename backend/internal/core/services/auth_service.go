package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
	"github.com/odealidj/pramuka-CAT/backend/pkg/tracer"
)

type authService struct {
	repo  ports.AuthRepository
	cache ports.AuthCache
}

// NewAuthService adalah constructor untuk membuat instance AuthService
func NewAuthService(repo ports.AuthRepository, cache ports.AuthCache) ports.AuthService {
	return &authService{
		repo:  repo,
		cache: cache,
	}
}

// Login memverifikasi user, meracik Dual Token, dan menyimpan sesi ke Postgres & Redis
func (s *authService) Login(ctx context.Context, req domain.LoginRequest) (domain.LoginResponse, error) {
	// 1. Cari user di database
	user, err := s.repo.GetUserByUsername(ctx, req.Username)
	if err != nil {
		return domain.LoginResponse{}, fmt.Errorf("username atau sandi salah")
	}

	// 2. Verifikasi Password
	err = utils.CheckPassword(req.Password, user.PasswordHash)
	if err != nil {
		return domain.LoginResponse{}, fmt.Errorf("username atau sandi salah")
	}

	// 3. Generate Session ID dan Token
	sessionID := uuid.New()

	accessToken, err := utils.CreateAccessToken(utils.TokenPayload{
		SessionID: sessionID,
		UserID:    user.ID,
		Role:      user.Role,
	})
	if err != nil {
		return domain.LoginResponse{}, fmt.Errorf("gagal meracik access token: %w", err)
	}

	refreshToken, err := utils.CreateRefreshToken(sessionID)
	if err != nil {
		return domain.LoginResponse{}, fmt.Errorf("gagal meracik refresh token: %w", err)
	}

	// 4. Simpan Refresh Token ke PostgreSQL
	expiresAt := time.Now().Add(7 * 24 * time.Hour) // Kedaluwarsa 7 Hari
	_, err = s.repo.CreateSession(ctx, sqlcgen.CreateSessionParams{
		ID:           sessionID,
		UserID:       user.ID,
		RefreshToken: refreshToken,
		IsBlocked:    false,
		ExpiresAt:    expiresAt,
	})
	if err != nil {
		return domain.LoginResponse{}, fmt.Errorf("gagal merekam sesi di database: %w", err)
	}

	// 5. Simpan Access Token ke Redis (hanya Session ID)
	// Cache umur 15 menit
	err = s.cache.SetSession(ctx, sessionID, user.ID, 15)
	if err != nil {
		// Log error, namun proses login tetap dilanjutkan
		log.Printf("Peringatan: Gagal menyimpan sesi ke Redis: %v\n", err)
	}

	// Track Business Metric: Tambahkan hitungan login
	tracer.AddLogin(ctx)

	var photoUrl *string
	if user.PhotoUrl.Valid {
		val := user.PhotoUrl.String
		photoUrl = &val
	}

	var emailStr *string
	if user.Email.Valid {
		val := user.Email.String
		emailStr = &val
	}

	return domain.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: domain.UserResponse{
			ID:                 user.ID,
			Username:           user.Username,
			Email:              emailStr,
			FullName:           user.FullName,
			Role:               user.Role,
			PhotoURL:           photoUrl,
			EmailNotifications: user.EmailNotifications,
		},
	}, nil
}

// Refresh memvalidasi Refresh Token ke DB, lalu membuat Access Token baru
func (s *authService) Refresh(ctx context.Context, req domain.RefreshRequest) (domain.RefreshResponse, error) {
	// 1. Validasi struktur Refresh Token
	payload, err := utils.ValidateToken(req.RefreshToken, true)
	if err != nil {
		return domain.RefreshResponse{}, fmt.Errorf("refresh token tidak valid atau kedaluwarsa")
	}
	sessionID := payload.SessionID

	// 2. Cari Sesi di PostgreSQL
	session, err := s.repo.GetSession(ctx, sessionID)
	if err != nil {
		return domain.RefreshResponse{}, fmt.Errorf("sesi tidak ditemukan")
	}

	// 3. Verifikasi Keamanan (Apakah di-block atau mismatch)
	if session.IsBlocked {
		return domain.RefreshResponse{}, fmt.Errorf("sesi Anda telah dicabut oleh sistem (blocked)")
	}
	if session.RefreshToken != req.RefreshToken {
		return domain.RefreshResponse{}, fmt.Errorf("sesi tidak cocok (terdeteksi pembajakan)")
	}
	if time.Now().After(session.ExpiresAt) {
		return domain.RefreshResponse{}, fmt.Errorf("sesi telah kedaluwarsa secara permanen, silahkan login kembali")
	}

	// 4. Tarik data User untuk payload Role
	user, err := s.repo.GetUserById(ctx, session.UserID)
	if err != nil {
		return domain.RefreshResponse{}, fmt.Errorf("gagal menarik data user terkait")
	}

	// 5. Racik Access Token baru
	newAccessToken, err := utils.CreateAccessToken(utils.TokenPayload{
		SessionID: sessionID,
		UserID:    user.ID,
		Role:      user.Role,
	})
	if err != nil {
		return domain.RefreshResponse{}, fmt.Errorf("gagal meracik access token baru: %w", err)
	}

	// Kita bisa me-rotasi refresh token juga di sini (Opsional).
	// Untuk saat ini, kita gunakan Refresh Token yang lama saja selama belum expired.

	// 6. Update Cache Redis (karena token baru terbit)
	err = s.cache.SetSession(ctx, sessionID, user.ID, 15)
	if err != nil {
		log.Printf("Peringatan: Gagal update cache Redis pada proses refresh: %v\n", err)
	}

	return domain.RefreshResponse{
		AccessToken:  newAccessToken,
		RefreshToken: req.RefreshToken, // Gunakan yang sama
	}, nil
}

// Logout membersihkan sesi di Redis dan memblokir di Postgres
func (s *authService) Logout(ctx context.Context, sessionID uuid.UUID) error {
	// 1. Hapus dari Redis
	err := s.cache.DeleteSession(ctx, sessionID)
	if err != nil {
		log.Printf("Peringatan: Gagal menghapus sesi dari Redis: %v\n", err)
	}

	// 2. Blokir secara permanen di Database
	err = s.repo.BlockSession(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("gagal mencabut sesi di database: %w", err)
	}

	return nil
}

// Register menangani pendaftaran akun peserta baru secara mandiri
func (s *authService) Register(ctx context.Context, req domain.RegisterRequest) (domain.RegisterResponse, error) {
	// Cek apakah username sudah ada
	_, err := s.repo.GetUserByUsername(ctx, req.Username)
	if err == nil {
		return domain.RegisterResponse{}, fmt.Errorf("username sudah digunakan")
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		return domain.RegisterResponse{}, fmt.Errorf("gagal memproses password")
	}

	email := sql.NullString{Valid: false}
	if req.Email != "" {
		email = sql.NullString{String: req.Email, Valid: true}
	}

	// Create user dengan role default "peserta"
	user, err := s.repo.CreateUser(ctx, sqlcgen.CreateUserParams{
		Username:     req.Username,
		PasswordHash: hashedPassword,
		FullName:     req.FullName,
		Role:         "peserta",
		Email:        email,
		// PhotoUrl dibiarkan kosong (invalid NullString)
	})
	if err != nil {
		return domain.RegisterResponse{}, fmt.Errorf("gagal membuat akun: %w", err)
	}

	var emailStr *string
	if user.Email.Valid {
		emailStr = &user.Email.String
	}

	return domain.RegisterResponse{
		User: domain.UserResponse{
			ID:                 user.ID,
			Username:           user.Username,
			Email:              emailStr,
			FullName:           user.FullName,
			Role:               user.Role,
			EmailNotifications: user.EmailNotifications,
		},
	}, nil
}
