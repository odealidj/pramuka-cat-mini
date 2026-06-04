package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
)

// ExamCache mendefinisikan kontrak untuk penyimpanan sementara ujian di Redis.
// Sesuai arsitektur PRD: jawaban peserta di-cache secara real-time di Redis,
// lalu di-push ke PostgreSQL saat ujian selesai/submit.
type ExamCache interface {
	// CacheExamSession menyimpan paket soal dan metadata ujian ke Redis
	CacheExamSession(ctx context.Context, approvalID uuid.UUID, questions []domain.ParticipantQuestion, durationMinutes int) error

	// GetCachedExamSession mengambil paket soal dari Redis (untuk auto-resume)
	GetCachedExamSession(ctx context.Context, approvalID uuid.UUID) ([]domain.ParticipantQuestion, error)

	// SaveAnswer menyimpan jawaban peserta secara real-time ke Redis
	SaveAnswer(ctx context.Context, approvalID uuid.UUID, questionID uuid.UUID, selectedAnswer string) error

	// GetAllAnswers mengambil seluruh jawaban peserta dari Redis (saat finish/submit)
	GetAllAnswers(ctx context.Context, approvalID uuid.UUID) (map[string]string, error)

	// GetRemainingTime menghitung sisa waktu ujian berdasarkan TTL key Redis
	GetRemainingTime(ctx context.Context, approvalID uuid.UUID) (int, error)

	// ClearExamSession menghapus seluruh cache ujian peserta setelah submit
	ClearExamSession(ctx context.Context, approvalID uuid.UUID) error

	// IsExamSessionExists mengecek apakah sesi ujian masih ada di Redis
	IsExamSessionExists(ctx context.Context, approvalID uuid.UUID) (bool, error)

	// CacheUpcomingEvents menyimpan sementara hasil query daftar event mendatang
	CacheUpcomingEvents(ctx context.Context, page, limit int32, events []domain.UpcomingEvent, total int64) error

	// GetCachedUpcomingEvents mengambil data cache event mendatang
	GetCachedUpcomingEvents(ctx context.Context, page, limit int32) ([]domain.UpcomingEvent, int64, error)
}
