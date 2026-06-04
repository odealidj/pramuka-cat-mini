package ports

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
)

type EventRepository interface {
	CreateEvent(ctx context.Context, e domain.Event) (domain.Event, error)
	GetEventById(ctx context.Context, id uuid.UUID) (domain.Event, error)
	CheckDuplicateEvent(ctx context.Context, name string, startTime, endTime time.Time, excludeID *uuid.UUID) (bool, error)
	ListEvents(ctx context.Context, page int32, limit int32, search string) ([]domain.Event, int64, error)
	UpdateEvent(ctx context.Context, id uuid.UUID, e domain.Event) (domain.Event, error)
	DeleteEvent(ctx context.Context, id uuid.UUID) error
	DeleteApprovalsByEventID(ctx context.Context, eventID uuid.UUID) error
	ListAllEventParticipants(ctx context.Context, eventID uuid.UUID) ([]sqlcgen.ListAllEventParticipantsRow, error)

	AddEventQuestion(ctx context.Context, eventID uuid.UUID, questionID uuid.UUID) error
	ListEventQuestions(ctx context.Context, eventID uuid.UUID, page int32, limit int32) ([]domain.Question, int64, error)
	RemoveEventQuestion(ctx context.Context, eventID uuid.UUID, questionID uuid.UUID) error

	ListEventParticipants(ctx context.Context, eventID uuid.UUID, page int32, limit int32, search string) ([]domain.EventParticipant, int64, error)
	ApproveUserEvent(ctx context.Context, approvalID uuid.UUID) error
	RevokeUserEvent(ctx context.Context, approvalID uuid.UUID) error
	RemoveUserEvent(ctx context.Context, approvalID uuid.UUID) error
	GetAllEventParticipantsForExport(ctx context.Context, eventID uuid.UUID) ([]domain.EventParticipantExport, error)

	AddRandomEventQuestions(ctx context.Context, eventID uuid.UUID, categoryID *int32, amount int32) error
	CountAvailableQuestions(ctx context.Context, eventID uuid.UUID, categoryID *int32) (int64, error)
	GetApprovalById(ctx context.Context, id uuid.UUID) (domain.UserEventApproval, error)
	GetUserById(ctx context.Context, id uuid.UUID) (domain.User, error)
}

type EventService interface {
	CreateEvent(ctx context.Context, req domain.CreateEventRequest) (domain.Event, error)
	GetEventById(ctx context.Context, id uuid.UUID) (domain.Event, error)
	ListEvents(ctx context.Context, page int32, limit int32, search string) ([]domain.Event, int64, error)
	UpdateEvent(ctx context.Context, id uuid.UUID, req domain.UpdateEventRequest) (domain.Event, error)
	DeleteEvent(ctx context.Context, id uuid.UUID) error

	AddEventQuestion(ctx context.Context, eventID uuid.UUID, req domain.AddEventQuestionRequest) error
	ListEventQuestions(ctx context.Context, eventID uuid.UUID, page int32, limit int32) ([]domain.Question, int64, error)
	RemoveEventQuestion(ctx context.Context, eventID uuid.UUID, questionID uuid.UUID) error
	AddRandomEventQuestions(ctx context.Context, eventID uuid.UUID, req domain.AddRandomEventQuestionsRequest) error
	ExportEventQuestionsExcel(ctx context.Context, eventID uuid.UUID, showKey bool) ([]byte, error)
	ExportEventQuestionsPDF(ctx context.Context, eventID uuid.UUID, showKey bool) ([]byte, error)

	ListEventParticipants(ctx context.Context, eventID uuid.UUID, page int32, limit int32, search string) ([]domain.EventParticipant, int64, error)
	ApproveUserEvent(ctx context.Context, approvalID uuid.UUID) error
	RevokeUserEvent(ctx context.Context, approvalID uuid.UUID) error
	RemoveUserEvent(ctx context.Context, approvalID uuid.UUID) error
	ExportEventParticipantsExcel(ctx context.Context, eventID uuid.UUID) ([]byte, error)
	ExportEventParticipantsPDF(ctx context.Context, eventID uuid.UUID) ([]byte, error)
}
