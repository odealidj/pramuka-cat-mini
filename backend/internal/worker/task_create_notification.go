package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
)

const TaskCreateNotification = "task:create_notification"

type PayloadCreateNotification struct {
	UserID  uuid.UUID `json:"user_id"`
	Title   string    `json:"title"`
	Message string    `json:"message"`
	Type    string    `json:"type"`
}

func (distributor *RedisTaskDistributor) DistributeTaskCreateNotification(
	ctx context.Context,
	payload *PayloadCreateNotification,
	opts ...asynq.Option,
) error {
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal task payload: %w", err)
	}

	task := asynq.NewTask(TaskCreateNotification, jsonPayload, opts...)
	info, err := distributor.client.EnqueueContext(ctx, task)
	if err != nil {
		return fmt.Errorf("failed to enqueue task: %w", err)
	}

	log.Printf("Enqueued task: type=%s queue=%s id=%s", task.Type(), info.Queue, info.ID)
	return nil
}

func (processor *RedisTaskProcessor) ProcessTaskCreateNotification(ctx context.Context, task *asynq.Task) error {
	var payload PayloadCreateNotification
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("Processing notification for user: %s, title: %s", payload.UserID, payload.Title)

	arg := sqlcgen.CreateNotificationParams{
		UserID:  payload.UserID,
		Title:   payload.Title,
		Message: payload.Message,
		Type:    payload.Type,
	}

	_, err := processor.repo.CreateNotification(ctx, arg)
	if err != nil {
		return fmt.Errorf("failed to create notification in db: %w", err)
	}

	log.Printf("Notification successfully created for user %s", payload.UserID)
	return nil
}
