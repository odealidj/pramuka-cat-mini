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

type examCache struct {
	client *redis.Client
}

func NewExamCache(client *redis.Client) ports.ExamCache {
	return &examCache{client: client}
}

func examQuestionsKey(approvalID uuid.UUID) string {
	return fmt.Sprintf("exam:%s:questions", approvalID.String())
}

func examAnswersKey(approvalID uuid.UUID) string {
	return fmt.Sprintf("exam:%s:answers", approvalID.String())
}

func (c *examCache) CacheExamSession(ctx context.Context, approvalID uuid.UUID, questions []domain.ParticipantQuestion, durationMinutes int) error {
	data, err := json.Marshal(questions)
	if err != nil {
		return fmt.Errorf("gagal serialize soal ujian: %w", err)
	}

	// TTL = durasi ujian + 10 menit toleransi
	expiration := time.Duration(durationMinutes+10) * time.Minute

	// Simpan soal ke Redis
	if err := c.client.Set(ctx, examQuestionsKey(approvalID), data, expiration).Err(); err != nil {
		return fmt.Errorf("gagal cache soal ujian di Redis: %w", err)
	}

	// Inisialisasi hash jawaban kosong dengan TTL yang sama
	// Set dummy field lalu hapus untuk membuat key dengan TTL
	pipe := c.client.Pipeline()
	pipe.HSet(ctx, examAnswersKey(approvalID), "__init__", "1")
	pipe.HDel(ctx, examAnswersKey(approvalID), "__init__")
	pipe.Expire(ctx, examAnswersKey(approvalID), expiration)
	_, err = pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("gagal inisialisasi hash jawaban di Redis: %w", err)
	}

	return nil
}

func (c *examCache) GetCachedExamSession(ctx context.Context, approvalID uuid.UUID) ([]domain.ParticipantQuestion, error) {
	data, err := c.client.Get(ctx, examQuestionsKey(approvalID)).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("sesi ujian tidak ditemukan di cache")
		}
		return nil, fmt.Errorf("gagal mengambil soal ujian dari Redis: %w", err)
	}

	var questions []domain.ParticipantQuestion
	if err := json.Unmarshal(data, &questions); err != nil {
		return nil, fmt.Errorf("gagal deserialize soal ujian: %w", err)
	}

	return questions, nil
}

func (c *examCache) SaveAnswer(ctx context.Context, approvalID uuid.UUID, questionID uuid.UUID, selectedAnswer string) error {
	err := c.client.HSet(ctx, examAnswersKey(approvalID), questionID.String(), selectedAnswer).Err()
	if err != nil {
		return fmt.Errorf("gagal menyimpan jawaban ke Redis: %w", err)
	}
	return nil
}

func (c *examCache) GetAllAnswers(ctx context.Context, approvalID uuid.UUID) (map[string]string, error) {
	result, err := c.client.HGetAll(ctx, examAnswersKey(approvalID)).Result()
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil jawaban dari Redis: %w", err)
	}
	return result, nil
}

func (c *examCache) GetRemainingTime(ctx context.Context, approvalID uuid.UUID) (int, error) {
	ttl, err := c.client.TTL(ctx, examQuestionsKey(approvalID)).Result()
	if err != nil {
		return 0, fmt.Errorf("gagal mengambil sisa waktu dari Redis: %w", err)
	}
	if ttl < 0 {
		return 0, nil
	}
	return int(ttl.Seconds()), nil
}

func (c *examCache) ClearExamSession(ctx context.Context, approvalID uuid.UUID) error {
	pipe := c.client.Pipeline()
	pipe.Del(ctx, examQuestionsKey(approvalID))
	pipe.Del(ctx, examAnswersKey(approvalID))
	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("gagal menghapus cache ujian dari Redis: %w", err)
	}
	return nil
}

func (c *examCache) IsExamSessionExists(ctx context.Context, approvalID uuid.UUID) (bool, error) {
	exists, err := c.client.Exists(ctx, examQuestionsKey(approvalID)).Result()
	if err != nil {
		return false, fmt.Errorf("gagal mengecek sesi ujian di Redis: %w", err)
	}
	return exists > 0, nil
}

func upcomingEventsKey(page, limit int32) string {
	return fmt.Sprintf("upcoming_events:page:%d:limit:%d", page, limit)
}

type cachedUpcoming struct {
	Events []domain.UpcomingEvent `json:"events"`
	Total  int64                  `json:"total"`
}

func (c *examCache) CacheUpcomingEvents(ctx context.Context, page, limit int32, events []domain.UpcomingEvent, total int64) error {
	payload := cachedUpcoming{
		Events: events,
		Total:  total,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("gagal serialize daftar event mendatang: %w", err)
	}

	// Cache selama 1 menit untuk menahan gempuran refresh halaman sebelum ujian mulai
	err = c.client.Set(ctx, upcomingEventsKey(page, limit), data, 1*time.Minute).Err()
	if err != nil {
		return fmt.Errorf("gagal menyimpan cache event mendatang: %w", err)
	}

	return nil
}

func (c *examCache) GetCachedUpcomingEvents(ctx context.Context, page, limit int32) ([]domain.UpcomingEvent, int64, error) {
	data, err := c.client.Get(ctx, upcomingEventsKey(page, limit)).Bytes()
	if err != nil {
		return nil, 0, err
	}

	var payload cachedUpcoming
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, 0, fmt.Errorf("gagal deserialize daftar event mendatang: %w", err)
	}

	return payload.Events, payload.Total, nil
}
