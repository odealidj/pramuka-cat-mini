package repository

import (
	"context"

	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
)

type dashboardRepository struct {
	queries *sqlcgen.Queries
}

func NewDashboardRepository(queries *sqlcgen.Queries) ports.DashboardRepository {
	return &dashboardRepository{
		queries: queries,
	}
}

func (r *dashboardRepository) GetTotalParticipants(ctx context.Context) (int64, error) {
	return r.queries.GetTotalParticipantsDashboard(ctx)
}

func (r *dashboardRepository) GetTotalQuestions(ctx context.Context) (int64, error) {
	return r.queries.GetTotalQuestionsDashboard(ctx)
}

func (r *dashboardRepository) GetTotalActiveEvents(ctx context.Context) (int64, error) {
	return r.queries.GetTotalActiveEventsDashboard(ctx)
}

func (r *dashboardRepository) GetTotalCompletedExams(ctx context.Context) (int64, error) {
	return r.queries.GetTotalCompletedExamsDashboard(ctx)
}

func (r *dashboardRepository) GetRecentActivities(ctx context.Context) ([]sqlcgen.GetRecentActivitiesDashboardRow, error) {
	return r.queries.GetRecentActivitiesDashboard(ctx)
}

func (r *dashboardRepository) GetAllActivities(ctx context.Context, limit, offset int32) ([]sqlcgen.GetAllActivitiesDashboardRow, error) {
	return r.queries.GetAllActivitiesDashboard(ctx, sqlcgen.GetAllActivitiesDashboardParams{
		Limit:  limit,
		Offset: offset,
	})
}

func (r *dashboardRepository) CountAllActivities(ctx context.Context) (int64, error) {
	return r.queries.CountAllActivitiesDashboard(ctx)
}
