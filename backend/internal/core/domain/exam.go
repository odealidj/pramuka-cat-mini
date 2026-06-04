package domain

import (
	"time"

	"github.com/google/uuid"
)

// UpcomingEvent merepresentasikan event tryout yang bisa didaftar
type UpcomingEvent struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	DurationMinutes int32     `json:"duration_minutes"`
	PassingGrade    float64   `json:"passing_grade"`
	TotalQuestions  int32     `json:"total_questions"`
}

// UserApproval merepresentasikan riwayat atau status pendaftaran peserta ke suatu event
type UserApproval struct {
	EventID         uuid.UUID  `json:"event_id"`
	Name            string     `json:"name"`
	StartTime       time.Time  `json:"start_time"`
	EndTime         time.Time  `json:"end_time"`
	DurationMinutes int32      `json:"duration_minutes"`
	QuestionCount   int32      `json:"question_count"`
	PassingGrade    float64    `json:"passing_grade"`
	ApprovalID      uuid.UUID  `json:"approval_id"`
	Status          string     `json:"status"` // pending, approved, revoked
	IsCompleted     bool       `json:"is_completed"`
	Score           float64    `json:"score"`
	IsPassed        bool       `json:"is_passed"`
	StartedAt       *time.Time `json:"started_at"`
	CompletedAt     *time.Time `json:"completed_at"`
	IsEventFinished bool       `json:"is_event_finished"` // true jika end_time sudah lewat (dihitung server)
}


// EnrollEventRequest untuk payload mendaftar tryout
type EnrollEventRequest struct {
	EventID uuid.UUID `json:"event_id" validate:"required"`
}

// ParticipantQuestion adalah bentuk soal yang SUDAH DIBUANG Kunci Jawabannya (Anti-Cheat)
type ParticipantQuestion struct {
	ID           uuid.UUID `json:"id"`
	QuestionText string    `json:"question_text"`
	OptionA      string    `json:"option_a"`
	OptionB      string    `json:"option_b"`
	OptionC      string    `json:"option_c"`
	OptionD      string    `json:"option_d"`
	Weight       int32     `json:"weight"`
}

// SubmitAnswerRequest payload saat peserta mengklik opsi A/B/C/D
type SubmitAnswerRequest struct {
	QuestionID     uuid.UUID `json:"question_id" validate:"required"`
	SelectedAnswer string    `json:"selected_answer" validate:"required,oneof=A B C D"`
}

type SubmitAnswerResponse struct {
	Message string `json:"message"`
}

// FinishExamResponse payload akhir saat ujian selesai
type FinishExamResponse struct {
	Message  string  `json:"message"`
	Score    float64 `json:"score"`
	IsPassed bool    `json:"is_passed"`
}

type UserAnswerDetail struct {
	AnswerID       uuid.UUID `json:"answer_id"`
	SelectedAnswer string    `json:"selected_answer"`
	IsCorrect      bool      `json:"is_correct"`
	QuestionID     uuid.UUID `json:"question_id"`
	QuestionText   string    `json:"question_text"`
	OptionA        string    `json:"option_a"`
	OptionB        string    `json:"option_b"`
	OptionC        string    `json:"option_c"`
	OptionD        string    `json:"option_d"`
	CorrectAnswer  string    `json:"correct_answer"`
	Weight         int32     `json:"weight"`
}
