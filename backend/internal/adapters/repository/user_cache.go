package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/redis/go-redis/v9"
)

type userCache struct {
	client *redis.Client
}

func NewUserCache(client *redis.Client) ports.UserCache {
	return &userCache{client: client}
}

func (c *userCache) CacheUserProfile(ctx context.Context, id uuid.UUID, user domain.User) error {
	key := fmt.Sprintf("user_profile:%s", id.String())
	data, err := json.Marshal(user)
	if err != nil {
		return err
	}
	// Cache profil berlaku selama 15 menit
	return c.client.Set(ctx, key, data, 15*time.Minute).Err()
}

func (c *userCache) GetCachedUserProfile(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	key := fmt.Sprintf("user_profile:%s", id.String())
	data, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil // Cache miss
	} else if err != nil {
		return nil, err
	}

	var user domain.User
	if err := json.Unmarshal(data, &user); err != nil {
		return nil, err
	}

	return &user, nil
}

func (c *userCache) DeleteCachedUserProfile(ctx context.Context, id uuid.UUID) error {
	key := fmt.Sprintf("user_profile:%s", id.String())
	return c.client.Del(ctx, key).Err()
}
