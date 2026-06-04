package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/redis/go-redis/v9"
)

type authCache struct {
	client *redis.Client
}

// NewAuthCache membungkus operasi Redis sebagai Outbound Adapter untuk fitur Autentikasi
func NewAuthCache(client *redis.Client) ports.AuthCache {
	return &authCache{
		client: client,
	}
}

func (c *authCache) SetSession(ctx context.Context, sessionID uuid.UUID, userID uuid.UUID, durationMinutes int) error {
	key := fmt.Sprintf("session:%s", sessionID.String())
	expiration := time.Duration(durationMinutes) * time.Minute

	// Menyimpan userID sebagai value agar kita tahu sesi ini milik siapa di Cache
	err := c.client.Set(ctx, key, userID.String(), expiration).Err()
	if err != nil {
		return fmt.Errorf("gagal set sesi di redis: %w", err)
	}
	return nil
}

func (c *authCache) GetSession(ctx context.Context, sessionID uuid.UUID) (string, error) {
	key := fmt.Sprintf("session:%s", sessionID.String())
	val, err := c.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return "", fmt.Errorf("sesi tidak ditemukan di cache")
		}
		return "", fmt.Errorf("gagal mengambil sesi dari redis: %w", err)
	}
	return val, nil
}

func (c *authCache) DeleteSession(ctx context.Context, sessionID uuid.UUID) error {
	key := fmt.Sprintf("session:%s", sessionID.String())
	err := c.client.Del(ctx, key).Err()
	if err != nil {
		return fmt.Errorf("gagal menghapus sesi dari redis: %w", err)
	}
	return nil
}
