package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/hibiken/asynq"
	"github.com/labstack/echo/v4"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/response"
	"github.com/odealidj/pramuka-CAT/backend/pkg/sse"
)

type DashboardHandler struct {
	service   ports.DashboardService
	broker    *sse.Broker
	inspector *asynq.Inspector
}

func NewDashboardHandler(service ports.DashboardService, broker *sse.Broker, inspector *asynq.Inspector) *DashboardHandler {
	return &DashboardHandler{
		service:   service,
		broker:    broker,
		inspector: inspector,
	}
}

// GetStats godoc
// @Summary     Dapatkan Statistik Dashboard
// @Description Endpoint khusus Admin/Super Admin untuk menampilkan statistik dashboard (peserta, event, bank soal, dan log aktivitas terkini).
// @Tags        Admin - Dashboard
// @Security    BearerAuth
// @Produce     json
// @Success     200 {object} response.SuccessResponse
// @Failure     500 {object} response.ErrorResponse
// @Router      /admin/dashboard/stats [get]
func (h *DashboardHandler) GetStats(c echo.Context) error {
	data, err := h.service.GetDashboardData(c.Request().Context())
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memuat statistik dashboard", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Statistik dashboard berhasil dimuat", data)
}

// GetActivities godoc
// @Summary     Dapatkan Log Aktivitas Dashboard
// @Description Endpoint khusus Admin/Super Admin untuk menampilkan semua log aktivitas secara paginasi.
// @Tags        Admin - Dashboard
// @Security    BearerAuth
// @Produce     json
// @Param       page query int false "Nomor halaman" default(1)
// @Param       limit query int false "Jumlah data per halaman" default(10)
// @Success     200 {object} response.SuccessResponse
// @Failure     500 {object} response.ErrorResponse
// @Router      /admin/dashboard/activities [get]
func (h *DashboardHandler) GetActivities(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	data, err := h.service.ListActivities(c.Request().Context(), int32(page), int32(limit))
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memuat log aktivitas", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Log aktivitas berhasil dimuat", data)
}

// Stream godoc
// @Summary     Stream Data Real-time Dashboard
// @Description Endpoint SSE (Server-Sent Events) untuk streaming statistik dan aktivitas dashboard.
// @Tags        Admin - Dashboard
// @Security    BearerAuth
// @Produce     text/event-stream
// @Success     200 "SSE Stream"
// @Router      /admin/dashboard/stream [get]
func (h *DashboardHandler) Stream(c echo.Context) error {
	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	// Agar proxy seperti Nginx tidak membuffer respon
	c.Response().Header().Set("X-Accel-Buffering", "no")

	clientChan := h.broker.Subscribe()
	defer h.broker.Unsubscribe(clientChan)

	// Kirim data inisial segera saat connect
	data, err := h.service.GetDashboardData(c.Request().Context())
	if err == nil {
		initialBytes, _ := json.Marshal(data)
		log.Println("SSE initial data:", string(initialBytes))
		fmt.Fprintf(c.Response().Writer, "data: %s\n\n", string(initialBytes))
		c.Response().Flush()
	}

	for {
		select {
		case msg := <-clientChan:
			fmt.Fprintf(c.Response().Writer, "data: %s\n\n", msg)
			c.Response().Flush()
		case <-c.Request().Context().Done():
			return nil
		}
	}
}

func (h *DashboardHandler) RegisterRoutes(g *echo.Group) {
	dashboardGroup := g.Group("/dashboard")
	dashboardGroup.GET("/stats", h.GetStats)
	dashboardGroup.GET("/activities", h.GetActivities)
	dashboardGroup.GET("/stream", h.Stream)
	dashboardGroup.GET("/jobs", h.GetJobs)
	dashboardGroup.DELETE("/jobs/failed", h.ClearFailedJobs)
}

// GetJobs godoc
// @Summary     Dapatkan Status Job Asynq
// @Description Endpoint khusus Admin/Super Admin untuk memonitor antrean job Asynq (Queue, Active, Pending, Failed).
// @Tags        Admin - Dashboard
// @Security    BearerAuth
// @Produce     json
// @Success     200 {object} response.SuccessResponse
// @Router      /admin/dashboard/jobs [get]
func (h *DashboardHandler) GetJobs(c echo.Context) error {
	queues, err := h.inspector.Queues()
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memuat status job", nil)
	}

	var results []map[string]interface{}
	for _, q := range queues {
		info, err := h.inspector.GetQueueInfo(q)
		if err != nil {
			continue
		}
		
		// Ambil rincian job gagal (archived) dan yang sedang diretry
		archivedJobs, _ := h.inspector.ListArchivedTasks(q, asynq.PageSize(100))
		retryJobs, _ := h.inspector.ListRetryTasks(q, asynq.PageSize(100))
		allFailed := append(archivedJobs, retryJobs...)
		
		var failedList []map[string]interface{}
		for _, fj := range allFailed {
			failedList = append(failedList, map[string]interface{}{
				"id":         fj.ID,
				"type":       fj.Type,
				"payload":    string(fj.Payload),
				"error":      fj.LastErr,
				"failed_at":  fj.LastFailedAt,
				"retried":    fj.Retried,
				"max_retry":  fj.MaxRetry,
			})
		}

		results = append(results, map[string]interface{}{
			"queue":     q,
			"active":    info.Active,
			"pending":   info.Pending,
			"failed":    info.Archived,
			"retry":     info.Retry,
			"completed": info.Completed,
			"failed_details": failedList,
		})
	}

	return response.Success(c, http.StatusOK, "Status job berhasil dimuat", results)
}

// ClearFailedJobs godoc
// @Summary     Bersihkan Job Gagal Asynq
// @Description Endpoint khusus Admin/Super Admin untuk menghapus semua job yang gagal di Asynq.
// @Tags        Admin - Dashboard
// @Security    BearerAuth
// @Produce     json
// @Success     200 {object} response.SuccessResponse
// @Router      /admin/dashboard/jobs/failed [delete]
func (h *DashboardHandler) ClearFailedJobs(c echo.Context) error {
	queues, err := h.inspector.Queues()
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mendapatkan antrean", nil)
	}

	deletedCount := 0
	for _, q := range queues {
		n, err := h.inspector.DeleteAllArchivedTasks(q)
		if err == nil {
			deletedCount += n
		}
	}

	return response.Success(c, http.StatusOK, fmt.Sprintf("%d job gagal berhasil dibersihkan", deletedCount), nil)
}
