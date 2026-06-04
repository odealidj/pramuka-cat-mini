package worker

import (
	"context"
	"github.com/hibiken/asynq"
)

// TaskDistributor mendefinisikan interface untuk mengirim job ke Redis Queue
type TaskDistributor interface {
	DistributeTaskSendEmail(ctx context.Context, payload *PayloadSendEmail, opts ...asynq.Option) error
	DistributeTaskCreateNotification(ctx context.Context, payload *PayloadCreateNotification, opts ...asynq.Option) error
	DistributeTaskFinishExam(ctx context.Context, payload *PayloadFinishExam, opts ...asynq.Option) error
	DistributeTaskCleanupNotifications(ctx context.Context, opts ...asynq.Option) error
}

type RedisTaskDistributor struct {
	client *asynq.Client
}

func NewRedisTaskDistributor(redisOpt asynq.RedisClientOpt) TaskDistributor {
	client := asynq.NewClient(redisOpt)
	return &RedisTaskDistributor{
		client: client,
	}
}
