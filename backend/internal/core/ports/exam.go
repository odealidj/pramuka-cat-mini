package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
)

type ExamRepository interface {
	ListUpcomingEvents(ctx context.Context, page int32, limit int32) ([]domain.UpcomingEvent, int64, error)
	ListUserApprovals(ctx context.Context, userID uuid.UUID, page int32, limit int32) ([]domain.UserApproval, int64, error)
	GetApprovalStatus(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) (domain.UserApproval, error)
	EnrollToEvent(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) error

	ListEventQuestionsForParticipant(ctx context.Context, eventID uuid.UUID) ([]domain.ParticipantQuestion, error)
	GetQuestionCorrectAnswer(ctx context.Context, questionID uuid.UUID) (string, error)
	SaveUserAnswer(ctx context.Context, approvalID uuid.UUID, questionID uuid.UUID, selectedAnswer string, isCorrect bool) error

	CalculateScore(ctx context.Context, approvalID uuid.UUID) (float64, error)
	GetEventTotalWeight(ctx context.Context, eventID uuid.UUID) (float64, error)
	FinishExam(ctx context.Context, approvalID uuid.UUID, score float64, isPassed bool) error
	SetStartedAt(ctx context.Context, approvalID uuid.UUID) error

	GetEventById(ctx context.Context, id uuid.UUID) (domain.Event, error)
	GetUserAnswersDetail(ctx context.Context, approvalID uuid.UUID) ([]domain.UserAnswerDetail, error)
}

type ExamService interface {
	ListUpcomingEvents(ctx context.Context, page int32, limit int32) ([]domain.UpcomingEvent, int64, error)
	ListMyExams(ctx context.Context, userID uuid.UUID, page int32, limit int32) ([]domain.UserApproval, int64, error)
	Enroll(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) error

	StartExam(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) ([]domain.ParticipantQuestion, error)
	SubmitAnswer(ctx context.Context, userID uuid.UUID, eventID uuid.UUID, req domain.SubmitAnswerRequest) error
	FinishExam(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) (domain.FinishExamResponse, error)

	ReviewParticipantAnswers(ctx context.Context, approvalID uuid.UUID) ([]domain.UserAnswerDetail, error)
	ReviewParticipantAnswersByEvent(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) ([]domain.UserAnswerDetail, error)
	ExportReviewAnswersPDF(ctx context.Context, approvalID uuid.UUID, participantName, eventName string, score float64, passingGrade float64, isPassed bool) ([]byte, error)
	ExportReviewAnswersByEventPDF(ctx context.Context, userID uuid.UUID, eventID uuid.UUID, participantName, eventName string, score float64, passingGrade float64, isPassed bool) ([]byte, error)
}
