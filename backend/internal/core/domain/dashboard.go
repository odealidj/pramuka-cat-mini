package domain

import "time"

type DashboardStats struct {
	TotalParticipants int64 `json:"total_participants"`
	TotalQuestions    int64 `json:"total_questions"`
	ActiveEvents      int64 `json:"active_events"`
	CompletedExams    int64 `json:"completed_exams"`
}

type DashboardActivity struct {
	UserName     string    `json:"name"`
	PhotoUrl     *string   `json:"photo_url"`
	Action       string    `json:"action"`
	Time         time.Time `json:"time"`
	Status       string    `json:"status"` // "pending", "approved", "completed", "expired"
	EventEndTime time.Time `json:"event_end_time"`
}

type DashboardData struct {
	Stats      DashboardStats      `json:"stats"`
	Activities []DashboardActivity `json:"activities"`
}

type DashboardActivityList struct {
	Data       []DashboardActivity `json:"data"`
	TotalItems int64               `json:"total_items"`
	TotalPages int32               `json:"total_pages"`
	Page       int32               `json:"page"`
	Limit      int32               `json:"limit"`
}
