package worker

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

const TaskFinishExam = "task:finish_exam"

type PayloadFinishExam struct {
	ApprovalID   uuid.UUID `json:"approval_id"`
	UserID       uuid.UUID `json:"user_id"`
	EventID      uuid.UUID `json:"event_id"`
	PassingGrade float64   `json:"passing_grade"`
}

func (distributor *RedisTaskDistributor) DistributeTaskFinishExam(
	ctx context.Context,
	payload *PayloadFinishExam,
	opts ...asynq.Option,
) error {
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("gagal marshal payload task finish exam: %w", err)
	}

	task := asynq.NewTask(TaskFinishExam, jsonPayload, opts...)
	info, err := distributor.client.EnqueueContext(ctx, task)
	if err != nil {
		return fmt.Errorf("gagal enqueue task finish exam: %w", err)
	}

	fmt.Printf("Task Finish Exam diantrekan: ID=%s, Queue=%s\n", info.ID, info.Queue)
	return nil
}

func (processor *RedisTaskProcessor) ProcessTaskFinishExam(ctx context.Context, task *asynq.Task) error {
	var payload PayloadFinishExam
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("gagal unmarshal payload: %w", err)
	}

	// 1. Ambil semua jawaban dari Redis
	answers, err := processor.examCache.GetAllAnswers(ctx, payload.ApprovalID)
	if err != nil {
		return fmt.Errorf("gagal mengambil jawaban dari cache: %w", err)
	}

	// 2. Loop dan Upsert ke DB
	for questionIDStr, selectedAnswer := range answers {
		questionID, err := uuid.Parse(questionIDStr)
		if err != nil {
			continue // skip invalid
		}

		correctAnswer, err := processor.examRepo.GetQuestionCorrectAnswer(ctx, questionID)
		if err != nil {
			continue // skip
		}

		isCorrect := (selectedAnswer == correctAnswer)
		_ = processor.examRepo.SaveUserAnswer(ctx, payload.ApprovalID, questionID, selectedAnswer, isCorrect)
	}

	// 3. Hitung skor
	score, err := processor.examRepo.CalculateScore(ctx, payload.ApprovalID)
	if err != nil {
		score = 0
	}

	totalWeight, err := processor.examRepo.GetEventTotalWeight(ctx, payload.EventID)
	if err == nil && totalWeight > 0 {
		score = (score / float64(totalWeight)) * 100
	}

	isPassed := score >= payload.PassingGrade

	err = processor.examRepo.FinishExam(ctx, payload.ApprovalID, score, isPassed)
	if err != nil {
		return fmt.Errorf("gagal finish exam di db: %w", err)
	}

	// 4. Bersihkan Cache Redis
	_ = processor.examCache.ClearExamSession(ctx, payload.ApprovalID)

	// 5. Publish SSE Update untuk Dashboard
	if processor.sseBroker != nil {
		_ = processor.sseBroker.Publish(ctx, `{"event":"exam_completed", "message":"Seseorang menyelesaikan ujian"}`)
	}

	return nil
}
