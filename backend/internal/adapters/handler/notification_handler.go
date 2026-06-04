package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	appMiddleware "github.com/odealidj/pramuka-CAT/backend/internal/adapters/middleware"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/response"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
)

type NotificationHandler struct {
	service ports.NotificationService
}

func NewNotificationHandler(service ports.NotificationService) *NotificationHandler {
	return &NotificationHandler{service: service}
}

func (h *NotificationHandler) RegisterRoutes(g *echo.Group) {
	notifGroup := g.Group("/notifications")
	notifGroup.GET("", h.GetUserNotifications)
	notifGroup.GET("/unread-count", h.GetUnreadCount)
	notifGroup.PUT("/:id/read", h.MarkAsRead)
	notifGroup.PUT("/read-all", h.MarkAllAsRead)
}

func getUserIDFromContextForNotif(c echo.Context) (uuid.UUID, error) {
	payloadValue := c.Get(appMiddleware.AuthorizationPayloadKey)
	if payloadValue == nil {
		return uuid.UUID{}, echo.NewHTTPError(http.StatusUnauthorized, "Tidak terautentikasi")
	}
	payload, ok := payloadValue.(*utils.TokenPayload)
	if !ok {
		return uuid.UUID{}, echo.NewHTTPError(http.StatusInternalServerError, "Terjadi kesalahan internal membaca sesi")
	}
	return payload.UserID, nil
}

// GetUserNotifications godoc
// @Summary     Dapatkan Daftar Notifikasi
// @Description Mengembalikan daftar notifikasi milik user yang sedang login
// @Tags        Notification
// @Security    BearerAuth
// @Produce     json
// @Success     200 {object} response.SuccessResponse
// @Router      /notifications [get]
func (h *NotificationHandler) GetUserNotifications(c echo.Context) error {
	userID, err := getUserIDFromContextForNotif(c)
	if err != nil {
		return err
	}

	notifs, err := h.service.GetUserNotifications(c.Request().Context(), userID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil notifikasi", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Berhasil mengambil notifikasi", notifs)
}

// GetUnreadCount godoc
// @Summary     Dapatkan Jumlah Notifikasi Belum Dibaca
// @Description Mengembalikan jumlah notifikasi belum dibaca milik user
// @Tags        Notification
// @Security    BearerAuth
// @Produce     json
// @Success     200 {object} response.SuccessResponse
// @Router      /notifications/unread-count [get]
func (h *NotificationHandler) GetUnreadCount(c echo.Context) error {
	userID, err := getUserIDFromContextForNotif(c)
	if err != nil {
		return err
	}

	count, err := h.service.GetUnreadCount(c.Request().Context(), userID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil jumlah notifikasi", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Berhasil", map[string]int64{"count": count})
}

// MarkAsRead godoc
// @Summary     Tandai Notifikasi Dibaca
// @Description Menandai satu notifikasi sebagai sudah dibaca
// @Tags        Notification
// @Security    BearerAuth
// @Param       id path string true "Notification ID"
// @Produce     json
// @Success     200 {object} response.SuccessResponse
// @Router      /notifications/{id}/read [put]
func (h *NotificationHandler) MarkAsRead(c echo.Context) error {
	userID, err := getUserIDFromContextForNotif(c)
	if err != nil {
		return err
	}

	notifID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID notifikasi tidak valid", nil)
	}

	err = h.service.MarkAsRead(c.Request().Context(), notifID, userID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menandai notifikasi", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Notifikasi ditandai sudah dibaca", nil)
}

// MarkAllAsRead godoc
// @Summary     Tandai Semua Notifikasi Dibaca
// @Description Menandai seluruh notifikasi user sebagai sudah dibaca
// @Tags        Notification
// @Security    BearerAuth
// @Produce     json
// @Success     200 {object} response.SuccessResponse
// @Router      /notifications/read-all [put]
func (h *NotificationHandler) MarkAllAsRead(c echo.Context) error {
	userID, err := getUserIDFromContextForNotif(c)
	if err != nil {
		return err
	}

	err = h.service.MarkAllAsRead(c.Request().Context(), userID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menandai semua notifikasi", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Semua notifikasi ditandai sudah dibaca", nil)
}
