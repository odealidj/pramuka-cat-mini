package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
)

type questionRepository struct {
	queries *sqlcgen.Queries
}

func NewQuestionRepository(queries *sqlcgen.Queries) ports.QuestionRepository {
	return &questionRepository{queries: queries}
}

// mapSqlcToDomainQuestion mengonversi dari model SQLC ke Entity Domain
func mapSqlcToDomainQuestion(q sqlcgen.Question) domain.Question {
	var catID *int32
	if q.CategoryID.Valid {
		catID = &q.CategoryID.Int32
	}

	var createdAt *time.Time
	if q.CreatedAt.Valid {
		t := q.CreatedAt.Time
		createdAt = &t
	}

	return domain.Question{
		ID:            q.ID,
		CategoryID:    catID,
		QuestionText:  q.QuestionText,
		OptionA:       q.OptionA,
		OptionB:       q.OptionB,
		OptionC:       q.OptionC,
		OptionD:       q.OptionD,
		CorrectAnswer: q.CorrectAnswer,
		Weight:        q.Weight,
		CreatedAt:     createdAt,
	}
}

func (r *questionRepository) CreateQuestion(ctx context.Context, q domain.Question) (domain.Question, error) {
	catID := sql.NullInt32{}
	if q.CategoryID != nil {
		catID = sql.NullInt32{Int32: *q.CategoryID, Valid: true}
	}

	res, err := r.queries.CreateQuestion(ctx, sqlcgen.CreateQuestionParams{
		CategoryID:    catID,
		QuestionText:  q.QuestionText,
		OptionA:       q.OptionA,
		OptionB:       q.OptionB,
		OptionC:       q.OptionC,
		OptionD:       q.OptionD,
		CorrectAnswer: q.CorrectAnswer,
		Weight:        q.Weight,
	})
	if err != nil {
		return domain.Question{}, err
	}
	return mapSqlcToDomainQuestion(res), nil
}

func (r *questionRepository) GetQuestionById(ctx context.Context, id uuid.UUID) (domain.Question, error) {
	res, err := r.queries.GetQuestionById(ctx, id)
	if err != nil {
		return domain.Question{}, err
	}
	return mapSqlcToDomainQuestion(res), nil
}

func (r *questionRepository) ListQuestions(ctx context.Context, page int32, limit int32, search string, categoryId *int32) ([]domain.Question, int64, error) {
	offset := (page - 1) * limit

	catID := sql.NullInt32{}
	if categoryId != nil {
		catID = sql.NullInt32{Int32: *categoryId, Valid: true}
	}

	rows, err := r.queries.ListQuestions(ctx, sqlcgen.ListQuestionsParams{
		Limit:      limit,
		Offset:     offset,
		Search:     search,
		CategoryID: catID,
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := r.queries.CountQuestions(ctx, sqlcgen.CountQuestionsParams{
		Search:     search,
		CategoryID: catID,
	})
	if err != nil {
		return nil, 0, err
	}

	var res []domain.Question
	for _, row := range rows {
		res = append(res, mapSqlcToDomainQuestion(row))
	}
	return res, total, nil
}

func (r *questionRepository) UpdateQuestion(ctx context.Context, id uuid.UUID, q domain.Question) (domain.Question, error) {
	catID := sql.NullInt32{}
	if q.CategoryID != nil {
		catID = sql.NullInt32{Int32: *q.CategoryID, Valid: true}
	}

	res, err := r.queries.UpdateQuestion(ctx, sqlcgen.UpdateQuestionParams{
		ID:            id,
		CategoryID:    catID,
		QuestionText:  q.QuestionText,
		OptionA:       q.OptionA,
		OptionB:       q.OptionB,
		OptionC:       q.OptionC,
		OptionD:       q.OptionD,
		CorrectAnswer: q.CorrectAnswer,
		Weight:        q.Weight,
	})
	if err != nil {
		return domain.Question{}, err
	}
	return mapSqlcToDomainQuestion(res), nil
}

func (r *questionRepository) DeleteQuestion(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteQuestion(ctx, id)
}

func (r *questionRepository) CheckDuplicateQuestion(ctx context.Context, text string, excludeID *uuid.UUID) (bool, error) {
	var excludeIDNull uuid.NullUUID
	if excludeID != nil {
		excludeIDNull = uuid.NullUUID{UUID: *excludeID, Valid: true}
	}

	_, err := r.queries.CheckDuplicateQuestion(ctx, sqlcgen.CheckDuplicateQuestionParams{
		QuestionText: text,
		ExcludeID:    excludeIDNull,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (r *questionRepository) CreateQuestionsBatch(ctx context.Context, questions []domain.Question) error {
	// Not all database drivers support native bulk insert easily without specific libraries
	// Here we use a transaction and standard parameterized inserts
	db, ok := r.queries.GetDB().(*sql.DB)
	if !ok {
		// If it's already a Tx, just execute in loop
		for _, q := range questions {
			_, err := r.CreateQuestion(ctx, q)
			if err != nil {
				return err
			}
		}
		return nil
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	qtx := r.queries.WithTx(tx)
	repoTx := NewQuestionRepository(qtx)

	for _, q := range questions {
		_, err := repoTx.CreateQuestion(ctx, q)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}
