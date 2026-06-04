package services

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
	"golang.org/x/crypto/bcrypt"
)

type userService struct {
	repo  ports.UserRepository
	cache ports.UserCache
}

func NewUserService(repo ports.UserRepository, cache ports.UserCache) ports.UserService {
	return &userService{repo: repo, cache: cache}
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func (s *userService) CreateUser(ctx context.Context, req domain.CreateUserRequest) (domain.User, error) {
	hashedPassword, err := hashPassword(req.Password)
	if err != nil {
		return domain.User{}, fmt.Errorf("gagal mengenkripsi kata sandi: %w", err)
	}

	emailStr := req.Email
	emailPtr := &emailStr
	if req.Email == "" {
		emailPtr = nil
	}

	u := domain.User{
		Username: req.Username,
		Email:    emailPtr,
		FullName: req.FullName,
		Role:     req.Role,
		PhotoURL: req.PhotoURL,
	}

	return s.repo.CreateUser(ctx, u, hashedPassword)
}

func (s *userService) GetUserById(ctx context.Context, id uuid.UUID) (domain.User, error) {
	if s.cache != nil {
		if cached, _ := s.cache.GetCachedUserProfile(ctx, id); cached != nil {
			return *cached, nil
		}
	}

	user, err := s.repo.GetUserById(ctx, id)
	if err != nil {
		return domain.User{}, err
	}

	if s.cache != nil {
		_ = s.cache.CacheUserProfile(ctx, id, user)
	}

	return user, nil
}

func (s *userService) ListUsers(ctx context.Context, page int32, limit int32, search string) ([]domain.User, int64, error) {
	return s.repo.ListUsers(ctx, page, limit, search)
}

func (s *userService) ListAdmins(ctx context.Context, page int32, limit int32, search string) ([]domain.User, int64, error) {
	return s.repo.ListAdmins(ctx, page, limit, search)
}

func (s *userService) UpdateUser(ctx context.Context, id uuid.UUID, req domain.UpdateUserRequest) (domain.User, error) {
	_, err := s.repo.GetUserById(ctx, id)
	if err != nil {
		return domain.User{}, fmt.Errorf("user tidak ditemukan")
	}

	emailStr := req.Email
	emailPtr := &emailStr
	if req.Email == "" {
		emailPtr = nil
	}

	u := domain.User{
		Username: req.Username,
		Email:    emailPtr,
		FullName: req.FullName,
		Role:     req.Role,
		PhotoURL: req.PhotoURL,
	}

	res, err := s.repo.UpdateUser(ctx, id, u)
	if err != nil {
		if strings.Contains(err.Error(), "idx_users_email") || strings.Contains(err.Error(), "users_email_key") {
			return domain.User{}, fmt.Errorf("email sudah digunakan oleh pengguna lain")
		}
		if strings.Contains(err.Error(), "users_username_key") {
			return domain.User{}, fmt.Errorf("username sudah digunakan oleh pengguna lain")
		}
		return domain.User{}, err
	}

	if s.cache != nil {
		_ = s.cache.DeleteCachedUserProfile(ctx, id)
	}

	return res, nil
}

func (s *userService) UpdateProfile(ctx context.Context, id uuid.UUID, req domain.UpdateProfileRequest) (domain.User, error) {
	existingUser, err := s.repo.GetUserById(ctx, id)
	if err != nil {
		return domain.User{}, fmt.Errorf("user tidak ditemukan")
	}

	emailStr := req.Email
	emailPtr := &emailStr
	if req.Email == "" {
		emailPtr = nil
	}

	u := domain.User{
		Username:           req.Username,
		Email:              emailPtr,
		FullName:           req.FullName,
		Role:               existingUser.Role,
		PhotoURL:           existingUser.PhotoURL,
		EmailNotifications: req.EmailNotifications,
	}

	res, err := s.repo.UpdateUser(ctx, id, u)
	if err == nil && s.cache != nil {
		_ = s.cache.DeleteCachedUserProfile(ctx, id)
	}
	return res, err
}

func (s *userService) UpdateUserPassword(ctx context.Context, id uuid.UUID, req domain.UpdateUserPasswordRequest) error {
	_, err := s.repo.GetUserById(ctx, id)
	if err != nil {
		return fmt.Errorf("user tidak ditemukan")
	}

	hashedPassword, err := hashPassword(req.Password)
	if err != nil {
		return fmt.Errorf("gagal mengenkripsi kata sandi: %w", err)
	}

	return s.repo.UpdateUserPassword(ctx, id, hashedPassword)
}

func (s *userService) ChangePassword(ctx context.Context, id uuid.UUID, req domain.UpdateProfilePasswordRequest) error {
	oldHash, err := s.repo.GetUserPasswordHash(ctx, id)
	if err != nil {
		return fmt.Errorf("user tidak ditemukan")
	}

	err = utils.CheckPassword(req.OldPassword, oldHash)
	if err != nil {
		return fmt.Errorf("kata sandi lama tidak sesuai")
	}

	hashedPassword, err := hashPassword(req.NewPassword)
	if err != nil {
		return fmt.Errorf("gagal mengenkripsi kata sandi baru: %w", err)
	}

	return s.repo.UpdateUserPassword(ctx, id, hashedPassword)
}

func (s *userService) UpdateUserPhoto(ctx context.Context, id uuid.UUID, photoUrl string) error {
	_, err := s.repo.GetUserById(ctx, id)
	if err != nil {
		return fmt.Errorf("user tidak ditemukan")
	}
	err = s.repo.UpdateUserPhoto(ctx, id, photoUrl)
	if err == nil && s.cache != nil {
		_ = s.cache.DeleteCachedUserProfile(ctx, id)
	}
	return err
}

func (s *userService) DeleteUser(ctx context.Context, id uuid.UUID) error {
	_, err := s.repo.GetUserById(ctx, id)
	if err != nil {
		return fmt.Errorf("user tidak ditemukan")
	}

	err = s.repo.DeleteUser(ctx, id)
	if err == nil && s.cache != nil {
		_ = s.cache.DeleteCachedUserProfile(ctx, id)
	}
	return err
}
