package worker

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"github.com/hibiken/asynq"
)

const TaskCleanupNotifications = "task:cleanup_notifications"

func (distributor *RedisTaskDistributor) DistributeTaskCleanupNotifications(
	ctx context.Context,
	opts ...asynq.Option,
) error {
	task := asynq.NewTask(TaskCleanupNotifications, nil, opts...)
	info, err := distributor.client.EnqueueContext(ctx, task)
	if err != nil {
		return fmt.Errorf("failed to enqueue task: %w", err)
	}

	log.Printf("Enqueued task: type=%s queue=%s id=%s", task.Type(), info.Queue, info.ID)
	return nil
}

func (processor *RedisTaskProcessor) ProcessTaskCleanupNotifications(ctx context.Context, task *asynq.Task) error {
	log.Printf("Mulai menjalankan pembersihan notifikasi kedaluwarsa...")

	events, err := processor.repo.GetExpiredEvents(ctx)
	if err != nil {
		return fmt.Errorf("gagal mengambil event kedaluwarsa: %w", err)
	}

	deletedCount := 0
	for _, event := range events {
		// Hapus notifikasi yang merujuk pada event name ini
		err := processor.repo.DeleteNotificationsByMessageLike(ctx, sql.NullString{String: event.Name, Valid: true})
		if err == nil {
			deletedCount++
		}
	}

	log.Printf("Pembersihan notifikasi selesai. Menghapus notifikasi dari %d event kedaluwarsa.", deletedCount)
	return nil
}
