package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/smtp"
	"os"

	"time"

	"github.com/hibiken/asynq"
	"github.com/sony/gobreaker"
)

var smtpCircuitBreaker *gobreaker.CircuitBreaker

func init() {
	st := gobreaker.Settings{
		Name:        "SMTPBreaker",
		MaxRequests: 1, // Number of requests allowed in half-open state
		Interval:    0, // Doesn't clear internal counts during closed state unless successful
		Timeout:     30 * time.Second, // Duration before entering half-open state after open
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			// Trip the breaker if 3 consecutive failures occur
			return counts.ConsecutiveFailures >= 3
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("Circuit Breaker '%s' changed state from %s to %s", name, from.String(), to.String())
		},
	}
	smtpCircuitBreaker = gobreaker.NewCircuitBreaker(st)
}

const TaskSendEmail = "task:send_email"

type PayloadSendEmail struct {
	ToAddress string `json:"to_address"`
	Subject   string `json:"subject"`
	Body      string `json:"body"`
}

func (distributor *RedisTaskDistributor) DistributeTaskSendEmail(
	ctx context.Context,
	payload *PayloadSendEmail,
	opts ...asynq.Option,
) error {
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal task payload: %w", err)
	}

	task := asynq.NewTask(TaskSendEmail, jsonPayload, opts...)
	info, err := distributor.client.EnqueueContext(ctx, task)
	if err != nil {
		return fmt.Errorf("failed to enqueue task: %w", err)
	}

	log.Printf("Enqueued task: type=%s queue=%s id=%s", task.Type(), info.Queue, info.ID)
	return nil
}

func (processor *RedisTaskProcessor) ProcessTaskSendEmail(ctx context.Context, task *asynq.Task) error {
	var payload PayloadSendEmail
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("Processing email to: %s, subject: %s", payload.ToAddress, payload.Subject)

	// SMTP configuration from env
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")
	smtpSender := os.Getenv("SMTP_SENDER")

	if smtpHost == "" || smtpPort == "" {
		log.Printf("Peringatan: Konfigurasi SMTP tidak lengkap. Email tidak dikirim.")
		return nil // Return nil agar task tidak ter-retry berulang kali jika config memang belum di set
	}

	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s", smtpSender, payload.ToAddress, payload.Subject, payload.Body))

	// Execute inside circuit breaker
	_, err := smtpCircuitBreaker.Execute(func() (interface{}, error) {
		err := smtp.SendMail(fmt.Sprintf("%s:%s", smtpHost, smtpPort), auth, smtpUser, []string{payload.ToAddress}, msg)
		return nil, err
	})

	if err != nil {
		return fmt.Errorf("failed to send email (circuit status: %v): %w", smtpCircuitBreaker.State().String(), err)
	}

	log.Printf("Email successfully sent to %s", payload.ToAddress)
	return nil
}
