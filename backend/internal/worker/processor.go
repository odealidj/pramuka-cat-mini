package worker

import (
	"context"
	"fmt"
	"github.com/hibiken/asynq"
	"log"

	"go.opentelemetry.io/otel"

	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/sse"
)

const (
	QueueCritical = "critical"
	QueueDefault  = "default"
)

// TaskProcessor mendefinisikan interface untuk memproses job
type TaskProcessor interface {
	Start() error
	ProcessTaskSendEmail(ctx context.Context, task *asynq.Task) error
	ProcessTaskCreateNotification(ctx context.Context, task *asynq.Task) error
	ProcessTaskFinishExam(ctx context.Context, task *asynq.Task) error
	ProcessTaskCleanupNotifications(ctx context.Context, task *asynq.Task) error
}

type RedisTaskProcessor struct {
	server          *asynq.Server
	repo            *sqlcgen.Queries // Akses ke database untuk nyimpan notif
	examRepo        ports.ExamRepository
	examCache       ports.ExamCache
	sseBroker       *sse.Broker
	taskDistributor TaskDistributor
}

func NewRedisTaskProcessor(redisOpt asynq.RedisClientOpt, repo *sqlcgen.Queries, examRepo ports.ExamRepository, examCache ports.ExamCache, sseBroker *sse.Broker, taskDistributor TaskDistributor) TaskProcessor {
	server := asynq.NewServer(
		redisOpt,
		asynq.Config{
			Queues: map[string]int{
				QueueCritical: 10,
				QueueDefault:  5,
			},
			ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
				log.Printf("ERROR: Process task %s failed: %v", task.Type(), err)

				retried, _ := asynq.GetRetryCount(ctx)
				maxRetry, _ := asynq.GetMaxRetry(ctx)

				if retried >= maxRetry {
					log.Printf("CRITICAL: Task %s reached max retry (%d) dan gagal permanen: %v", task.Type(), maxRetry, err)
					if sseBroker != nil {
						msg := fmt.Sprintf(`{"event":"job_failed", "message":"Job %s gagal permanen: %v"}`, task.Type(), err)
						_ = sseBroker.Publish(context.Background(), msg)
					}

					// Notify Admins
					if taskDistributor != nil {
						// Ambil daftar admin (maksimal 50 admin saja untuk mencegah flooding)
						admins, err := repo.ListAdmins(context.Background(), sqlcgen.ListAdminsParams{Limit: 50, Offset: 0, Search: ""})
						if err == nil {
							for _, admin := range admins {
							// Buat notifikasi di DB
							_ = taskDistributor.DistributeTaskCreateNotification(context.Background(), &PayloadCreateNotification{
								UserID:  admin.ID,
								Title:   "Background Job Gagal Permanen",
								Message: fmt.Sprintf("Job tipe %s telah gagal setelah percobaan maksimal. Error: %v", task.Type(), err),
								Type:    "system_error",
							})

							// Kirim email (jangan kirim jika yang gagal adalah tugas kirim email itu sendiri)
							if task.Type() != TaskSendEmail && admin.Email.Valid && admin.Email.String != "" {
								_ = taskDistributor.DistributeTaskSendEmail(context.Background(), &PayloadSendEmail{
									ToAddress: admin.Email.String,
									Subject:   "[CRITICAL] Background Job Gagal Permanen",
									Body:      fmt.Sprintf("Halo %s,\n\nJob latar belakang dengan tipe %s gagal diproses setelah upaya maksimal.\n\nError: %v\n\nHarap periksa sistem segera.", admin.FullName, task.Type(), err),
								})
							}
							}
						}
					}
				}
			}),
		},
	)

	return &RedisTaskProcessor{
		server:          server,
		repo:            repo,
		examRepo:        examRepo,
		examCache:       examCache,
		sseBroker:       sseBroker,
		taskDistributor: taskDistributor,
	}
}

func (processor *RedisTaskProcessor) Start() error {
	mux := asynq.NewServeMux()

	// Tracing Middleware for OpenTelemetry
	mux.Use(func(next asynq.Handler) asynq.Handler {
		return asynq.HandlerFunc(func(ctx context.Context, task *asynq.Task) error {
			ctx, span := otel.Tracer("asynq-worker").Start(ctx, fmt.Sprintf("ProcessTask: %s", task.Type()))
			defer span.End()
			return next.ProcessTask(ctx, task)
		})
	})

	mux.HandleFunc(TaskSendEmail, processor.ProcessTaskSendEmail)
	mux.HandleFunc(TaskCreateNotification, processor.ProcessTaskCreateNotification)
	mux.HandleFunc(TaskFinishExam, processor.ProcessTaskFinishExam)
	mux.HandleFunc(TaskCleanupNotifications, processor.ProcessTaskCleanupNotifications)

	return processor.server.Start(mux)
}
