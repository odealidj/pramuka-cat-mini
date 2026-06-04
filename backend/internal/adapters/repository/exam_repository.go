package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
)

type examRepository struct {
	queries *sqlcgen.Queries
}

func NewExamRepository(queries *sqlcgen.Queries) ports.ExamRepository {
	return &examRepository{queries: queries}
}

func (r *examRepository) ListUpcomingEvents(ctx context.Context, page int32, limit int32) ([]domain.UpcomingEvent, int64, error) {
	offset := (page - 1) * limit
	rows, err := r.queries.ListUpcomingEvents(ctx, sqlcgen.ListUpcomingEventsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := r.queries.CountUpcomingEvents(ctx)
	if err != nil {
		return nil, 0, err
	}

	var events []domain.UpcomingEvent
	for _, e := range rows {
		passingGrade, _ := strconv.ParseFloat(e.PassingGrade, 64)
		events = append(events, domain.UpcomingEvent{
			ID:              e.ID,
			Name:            e.Name,
			StartTime:       e.StartTime,
			EndTime:         e.EndTime,
			DurationMinutes: e.DurationMinutes,
			PassingGrade:    passingGrade,
			TotalQuestions:  e.TotalQuestions,
		})
	}
	return events, total, nil
}

func mapSqlcListUpcomingEventsRowToDomainEvent(e sqlcgen.ListUpcomingEventsRow) domain.Event {
	var createdAt time.Time
	if e.CreatedAt.Valid {
		createdAt = e.CreatedAt.Time
	}

	passingGrade, _ := strconv.ParseFloat(e.PassingGrade, 64)

	return domain.Event{
		ID:              e.ID,
		Name:            e.Name,
		StartTime:       e.StartTime,
		EndTime:         e.EndTime,
		DurationMinutes: e.DurationMinutes,
		PassingGrade:    passingGrade,
		CreatedAt:       createdAt,
		TotalQuestions:  e.TotalQuestions,
	}
}

func (r *examRepository) ListUserApprovals(ctx context.Context, userID uuid.UUID, page int32, limit int32) ([]domain.UserApproval, int64, error) {
	offset := (page - 1) * limit
	rows, err := r.queries.ListUserApprovals(ctx, sqlcgen.ListUserApprovalsParams{
		UserID: uuid.NullUUID{UUID: userID, Valid: true},
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := r.queries.CountUserApprovals(ctx, uuid.NullUUID{UUID: userID, Valid: true})
	if err != nil {
		return nil, 0, err
	}

	var approvals []domain.UserApproval
	for _, row := range rows {
		passingGrade, _ := strconv.ParseFloat(row.PassingGrade, 64)
		score, _ := strconv.ParseFloat(row.Score.String, 64)

		var startedAt *time.Time
		if row.StartedAt.Valid {
			t := row.StartedAt.Time
			startedAt = &t
		}

		var completedAt *time.Time
		if row.CompletedAt.Valid {
			t := row.CompletedAt.Time
			completedAt = &t
		}

		approvals = append(approvals, domain.UserApproval{
			EventID:         row.ID,
			Name:            row.Name,
			StartTime:       row.StartTime,
			EndTime:         row.EndTime,
			DurationMinutes: row.DurationMinutes,
			QuestionCount:   row.QuestionCount,
			PassingGrade:    passingGrade,
			ApprovalID:      row.ApprovalID,
			Status:          row.Status,
			IsCompleted:     row.IsCompleted,
			Score:           score,
			IsPassed:        row.IsPassed.Bool,
			StartedAt:       startedAt,
			CompletedAt:     completedAt,
			IsEventFinished: time.Now().After(row.EndTime),
		})

	}
	return approvals, total, nil
}

func (r *examRepository) GetApprovalStatus(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) (domain.UserApproval, error) {
	row, err := r.queries.GetApprovalStatus(ctx, sqlcgen.GetApprovalStatusParams{
		UserID:  uuid.NullUUID{UUID: userID, Valid: true},
		EventID: uuid.NullUUID{UUID: eventID, Valid: true},
	})
	if err != nil {
		return domain.UserApproval{}, err
	}

	score, _ := strconv.ParseFloat(row.Score.String, 64)
	passingGrade, _ := strconv.ParseFloat(row.PassingGrade, 64)
	var startedAt *time.Time
	if row.StartedAt.Valid {
		t := row.StartedAt.Time
		startedAt = &t
	}

	var completedAt *time.Time
	if row.CompletedAt.Valid {
		t := row.CompletedAt.Time
		completedAt = &t
	}

	return domain.UserApproval{
		ApprovalID:   row.ID,
		EventID:      row.EventID.UUID,
		Status:       row.Status,
		IsCompleted:  row.IsCompleted,
		Score:        score,
		PassingGrade: passingGrade,
		QuestionCount: row.QuestionCount,
		IsPassed:     row.IsPassed.Bool,
		StartedAt:    startedAt,
		CompletedAt:  completedAt,
		StartTime:    row.StartTime,
		EndTime:      row.EndTime,
	}, nil
}

func (r *examRepository) EnrollToEvent(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) error {
	_, err := r.queries.EnrollUserToEvent(ctx, sqlcgen.EnrollUserToEventParams{
		UserID:  uuid.NullUUID{UUID: userID, Valid: true},
		EventID: uuid.NullUUID{UUID: eventID, Valid: true},
	})
	return err
}

func (r *examRepository) ListEventQuestionsForParticipant(ctx context.Context, eventID uuid.UUID) ([]domain.ParticipantQuestion, error) {
	// For participant execution, we typically get all questions at once without pagination.
	// We'll reuse ListEventQuestions query but without pagination limit (e.g. limit 1000).
	rows, err := r.queries.ListEventQuestions(ctx, sqlcgen.ListEventQuestionsParams{
		EventID: eventID,
		Limit:   1000,
		Offset:  0,
	})
	if err != nil {
		return nil, err
	}

	var questions []domain.ParticipantQuestion
	for _, q := range rows {
		questions = append(questions, domain.ParticipantQuestion{
			ID:           q.ID,
			QuestionText: q.QuestionText,
			OptionA:      q.OptionA,
			OptionB:      q.OptionB,
			OptionC:      q.OptionC,
			OptionD:      q.OptionD,
			Weight:       q.Weight,
		})
	}
	return questions, nil
}

func (r *examRepository) GetQuestionCorrectAnswer(ctx context.Context, questionID uuid.UUID) (string, error) {
	q, err := r.queries.GetQuestionById(ctx, questionID)
	if err != nil {
		return "", err
	}
	return q.CorrectAnswer, nil
}

func (r *examRepository) SaveUserAnswer(ctx context.Context, approvalID uuid.UUID, questionID uuid.UUID, selectedAnswer string, isCorrect bool) error {
	_, err := r.queries.SaveUserAnswer(ctx, sqlcgen.SaveUserAnswerParams{
		ApprovalID:     uuid.NullUUID{UUID: approvalID, Valid: true},
		QuestionID:     uuid.NullUUID{UUID: questionID, Valid: true},
		SelectedAnswer: sql.NullString{String: selectedAnswer, Valid: true},
		IsCorrect:      sql.NullBool{Bool: isCorrect, Valid: true},
	})
	return err
}

func (r *examRepository) CalculateScore(ctx context.Context, approvalID uuid.UUID) (float64, error) {
	scoreStr, err := r.queries.CalculateScore(ctx, uuid.NullUUID{UUID: approvalID, Valid: true})
	if err != nil {
		return 0, err
	}
	score, _ := strconv.ParseFloat(scoreStr, 64)
	return score, nil
}

func (r *examRepository) GetEventTotalWeight(ctx context.Context, eventID uuid.UUID) (float64, error) {
	weightStr, err := r.queries.GetEventTotalWeight(ctx, eventID)
	if err != nil {
		return 0, err
	}
	weight, _ := strconv.ParseFloat(weightStr, 64)
	return weight, nil
}

func (r *examRepository) FinishExam(ctx context.Context, approvalID uuid.UUID, score float64, isPassed bool) error {
	scoreStr := fmt.Sprintf("%.2f", score)
	return r.queries.FinishExam(ctx, sqlcgen.FinishExamParams{
		ID:       approvalID,
		Score:    sql.NullString{String: scoreStr, Valid: true},
		IsPassed: sql.NullBool{Bool: isPassed, Valid: true},
	})
}

func (r *examRepository) GetEventById(ctx context.Context, id uuid.UUID) (domain.Event, error) {
	res, err := r.queries.GetEventById(ctx, id)
	if err != nil {
		return domain.Event{}, err
	}
	return mapSqlcGetEventByIdRowToDomainEvent(res), nil
}

func (r *examRepository) GetUserAnswersDetail(ctx context.Context, approvalID uuid.UUID) ([]domain.UserAnswerDetail, error) {
	rows, err := r.queries.GetUserAnswersDetail(ctx, uuid.NullUUID{UUID: approvalID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("failed to get user answers detail: %w", err)
	}

	results := make([]domain.UserAnswerDetail, 0, len(rows))
	for _, row := range rows {
		results = append(results, domain.UserAnswerDetail{
			AnswerID:       row.AnswerID,
			SelectedAnswer: row.SelectedAnswer.String,
			IsCorrect:      row.IsCorrect.Bool,
			QuestionID:     row.QuestionID,
			QuestionText:   row.QuestionText,
			OptionA:        row.OptionA,
			OptionB:        row.OptionB,
			OptionC:        row.OptionC,
			OptionD:        row.OptionD,
			CorrectAnswer:  row.CorrectAnswer,
			Weight:         row.Weight,
		})
	}

	return results, nil
}

func (r *examRepository) SetStartedAt(ctx context.Context, approvalID uuid.UUID) error {
	return r.queries.SetStartedAt(ctx, approvalID)
}

// mapSqlcToDomainEvent is already defined in event_repository.go; here we need a local time helper
func examRepoTimeOrZero(t time.Time, valid bool) time.Time {
	if !valid {
		return time.Time{}
	}
	return t
}
