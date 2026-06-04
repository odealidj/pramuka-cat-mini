package ports

import (
	"context"

	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
)

type DashboardRepository interface {
	GetTotalParticipants(ctx context.Context) (int64, error)
	GetTotalQuestions(ctx context.Context) (int64, error)
	GetTotalActiveEvents(ctx context.Context) (int64, error)
	GetTotalCompletedExams(ctx context.Context) (int64, error)
	GetRecentActivities(ctx context.Context) ([]sqlcgen.GetRecentActivitiesDashboardRow, error)
	GetAllActivities(ctx context.Context, limit, offset int32) ([]sqlcgen.GetAllActivitiesDashboardRow, error)
	CountAllActivities(ctx context.Context) (int64, error)
}

type DashboardService interface {
	GetDashboardData(ctx context.Context) (*domain.DashboardData, error)
	ListActivities(ctx context.Context, page, limit int32) (*domain.DashboardActivityList, error)
}
