package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
)

type notificationRepository struct {
	queries *sqlcgen.Queries
}

func NewNotificationRepository(queries *sqlcgen.Queries) ports.NotificationRepository {
	return &notificationRepository{queries: queries}
}

func (r *notificationRepository) GetUserNotifications(ctx context.Context, userID uuid.UUID) ([]domain.Notification, error) {
	rows, err := r.queries.GetUserNotifications(ctx, sqlcgen.GetUserNotificationsParams{
		UserID: userID,
		Limit:  50, // default limit 50
		Offset: 0,
	})
	if err != nil {
		return nil, err
	}

	var results []domain.Notification
	for _, row := range rows {
		results = append(results, domain.Notification{
			ID:        row.ID,
			UserID:    row.UserID,
			Title:     row.Title,
			Message:   row.Message,
			Type:      row.Type,
			IsRead:    row.IsRead,
			CreatedAt: row.CreatedAt,
		})
	}
	return results, nil
}

func (r *notificationRepository) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	return r.queries.CountUnreadNotifications(ctx, userID)
}

func (r *notificationRepository) MarkAsRead(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	return r.queries.MarkNotificationAsRead(ctx, sqlcgen.MarkNotificationAsReadParams{
		ID:     id,
		UserID: userID,
	})
}

func (r *notificationRepository) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	return r.queries.MarkAllNotificationsAsRead(ctx, userID)
}
