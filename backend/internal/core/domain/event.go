package domain

import (
	"time"

	"github.com/google/uuid"
)

type Event struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	DurationMinutes int32     `json:"duration_minutes"`
	PassingGrade    float64   `json:"passing_grade"`
	CreatedAt       time.Time `json:"created_at"`
	TotalQuestions  int32     `json:"total_questions"`
}

type CreateEventRequest struct {
	Name            string    `json:"name" validate:"required"`
	StartTime       time.Time `json:"start_time" validate:"required"`
	EndTime         time.Time `json:"end_time" validate:"required"`
	DurationMinutes int32     `json:"duration_minutes" validate:"required,min=1"`
	PassingGrade    float64   `json:"passing_grade" validate:"required,min=0,max=100"`
}

type UpdateEventRequest struct {
	Name            string    `json:"name" validate:"required"`
	StartTime       time.Time `json:"start_time" validate:"required"`
	EndTime         time.Time `json:"end_time" validate:"required"`
	DurationMinutes int32     `json:"duration_minutes" validate:"required,min=1"`
	PassingGrade    float64   `json:"passing_grade" validate:"required,min=0,max=100"`
}

type EventParticipant struct {
	UserID      uuid.UUID `json:"user_id"`
	ApprovalID  uuid.UUID `json:"approval_id"`
	Username    string    `json:"username"`
	FullName    string    `json:"full_name"`
	Status      string    `json:"status"`
	IsCompleted bool      `json:"is_completed"`
	Score       float64   `json:"score"`
	IsPassed    bool      `json:"is_passed"`
}

type AddEventQuestionRequest struct {
	QuestionID uuid.UUID `json:"question_id" validate:"required"`
}

type AddRandomEventQuestionsRequest struct {
	CategoryID *int32 `json:"category_id"`
	Amount     int32  `json:"amount" validate:"required,min=1"`
}

type EventParticipantExport struct {
	Username    string     `json:"username"`
	FullName    string     `json:"full_name"`
	Status      string     `json:"status"`
	IsCompleted bool       `json:"is_completed"`
	Score       float64    `json:"score"`
	IsPassed    bool       `json:"is_passed"`
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
}

type UserEventApproval struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	EventID     uuid.UUID
	Status      string
	IsCompleted bool
}
