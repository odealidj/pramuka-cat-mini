package services

import (
	"context"
	"fmt"
	"time"

	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
)

type dashboardService struct {
	repo ports.DashboardRepository
}

func NewDashboardService(repo ports.DashboardRepository) ports.DashboardService {
	return &dashboardService{
		repo: repo,
	}
}

func (s *dashboardService) GetDashboardData(ctx context.Context) (*domain.DashboardData, error) {
	totalParticipants, err := s.repo.GetTotalParticipants(ctx)
	if err != nil {
		return nil, err
	}

	totalQuestions, err := s.repo.GetTotalQuestions(ctx)
	if err != nil {
		return nil, err
	}

	activeEvents, err := s.repo.GetTotalActiveEvents(ctx)
	if err != nil {
		return nil, err
	}

	completedExams, err := s.repo.GetTotalCompletedExams(ctx)
	if err != nil {
		return nil, err
	}

	recentRows, err := s.repo.GetRecentActivities(ctx)
	if err != nil {
		return nil, err
	}

	var activities []domain.DashboardActivity
	for _, r := range recentRows {
		action := ""
		if r.Status == "pending" {
			action = fmt.Sprintf("Mendaftar event: %s", r.EventName)
		} else if r.Status == "approved" && !r.IsCompleted {
			action = fmt.Sprintf("Persetujuan ujian disetujui admin untuk event: %s", r.EventName)
		} else if r.Status == "approved" && r.IsCompleted {
			score := ""
			if r.Score.Valid {
				score = r.Score.String
			}
			action = fmt.Sprintf("Menyelesaikan ujian %s dengan skor %s", r.EventName, score)
		}

		var activityTime time.Time
		if r.ActivityTime.Valid {
			activityTime = r.ActivityTime.Time
		} else {
			activityTime = time.Now()
		}

		var photoUrl *string
		if r.UserPhotoUrl.Valid {
			photoUrl = &r.UserPhotoUrl.String
		}

		activities = append(activities, domain.DashboardActivity{
			UserName:     r.UserName,
			PhotoUrl:     photoUrl,
			Action:       action,
			Time:         activityTime,
			Status:       r.Status,
			EventEndTime: r.EventEndTime,
		})
	}

	if activities == nil {
		activities = []domain.DashboardActivity{}
	}

	return &domain.DashboardData{
		Stats: domain.DashboardStats{
			TotalParticipants: totalParticipants,
			TotalQuestions:    totalQuestions,
			ActiveEvents:      activeEvents,
			CompletedExams:    completedExams,
		},
		Activities: activities,
	}, nil
}

func (s *dashboardService) ListActivities(ctx context.Context, page, limit int32) (*domain.DashboardActivityList, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	totalItems, err := s.repo.CountAllActivities(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.repo.GetAllActivities(ctx, limit, offset)
	if err != nil {
		return nil, err
	}

	var activities []domain.DashboardActivity
	for _, r := range rows {
		action := ""
		if r.Status == "pending" {
			action = fmt.Sprintf("Mendaftar event: %s", r.EventName)
		} else if r.Status == "approved" && !r.IsCompleted {
			action = fmt.Sprintf("Persetujuan ujian disetujui admin untuk event: %s", r.EventName)
		} else if r.Status == "approved" && r.IsCompleted {
			score := ""
			if r.Score.Valid {
				score = r.Score.String
			}
			action = fmt.Sprintf("Menyelesaikan ujian %s dengan skor %s", r.EventName, score)
		}

		var activityTime time.Time
		if r.ActivityTime.Valid {
			activityTime = r.ActivityTime.Time
		} else {
			activityTime = time.Now()
		}

		var photoUrl *string
		if r.UserPhotoUrl.Valid {
			photoUrl = &r.UserPhotoUrl.String
		}

		activities = append(activities, domain.DashboardActivity{
			UserName:     r.UserName,
			PhotoUrl:     photoUrl,
			Action:       action,
			Time:         activityTime,
			Status:       r.Status,
			EventEndTime: r.EventEndTime,
		})
	}

	if activities == nil {
		activities = []domain.DashboardActivity{}
	}

	totalPages := int32(totalItems) / limit
	if int32(totalItems)%limit > 0 {
		totalPages++
	}

	return &domain.DashboardActivityList{
		Data:       activities,
		TotalItems: totalItems,
		TotalPages: totalPages,
		Page:       page,
		Limit:      limit,
	}, nil
}
