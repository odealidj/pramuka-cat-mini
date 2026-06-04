package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
)

// QuestionRepository menangani operasi database untuk Question
type QuestionRepository interface {
	CreateQuestion(ctx context.Context, q domain.Question) (domain.Question, error)
	GetQuestionById(ctx context.Context, id uuid.UUID) (domain.Question, error)
	ListQuestions(ctx context.Context, page int32, limit int32, search string, categoryId *int32) ([]domain.Question, int64, error)
	UpdateQuestion(ctx context.Context, id uuid.UUID, q domain.Question) (domain.Question, error)
	DeleteQuestion(ctx context.Context, id uuid.UUID) error
	CheckDuplicateQuestion(ctx context.Context, text string, excludeID *uuid.UUID) (bool, error)
	CreateQuestionsBatch(ctx context.Context, questions []domain.Question) error
}

// QuestionService menangani business logic untuk Question
type QuestionService interface {
	CreateQuestion(ctx context.Context, req domain.CreateQuestionRequest) (domain.Question, error)
	GetQuestionById(ctx context.Context, id uuid.UUID) (domain.Question, error)
	ListQuestions(ctx context.Context, page int32, limit int32, search string, categoryId *int32) ([]domain.Question, int64, error)
	UpdateQuestion(ctx context.Context, id uuid.UUID, req domain.UpdateQuestionRequest) (domain.Question, error)
	DeleteQuestion(ctx context.Context, id uuid.UUID) error
	PreviewImportExcel(ctx context.Context, file []byte) (*domain.ImportQuestionsPreviewResponse, error)
	ConfirmImportExcel(ctx context.Context, req domain.ConfirmImportRequest) (int, error)
	DownloadTemplateExcel(ctx context.Context) ([]byte, error)
}
