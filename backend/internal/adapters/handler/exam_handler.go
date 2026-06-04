package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	appMiddleware "github.com/odealidj/pramuka-CAT/backend/internal/adapters/middleware"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/response"
	"github.com/odealidj/pramuka-CAT/backend/pkg/sse"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
)

type ExamHandler struct {
	service ports.ExamService
	broker  *sse.Broker
}

func NewExamHandler(service ports.ExamService, broker *sse.Broker) *ExamHandler {
	return &ExamHandler{service: service, broker: broker}
}

func (h *ExamHandler) RegisterParticipantRoutes(protectedGroup *echo.Group) {
	examsGroup := protectedGroup.Group("/exams")
	examsGroup.GET("/upcoming", h.ListUpcomingEvents)
	examsGroup.GET("/my-exams", h.ListMyExams)
	examsGroup.POST("/enroll", h.Enroll)

	// Ujian sedang berlangsung
	examsGroup.GET("/:id/start", h.StartExam)
	examsGroup.POST("/:id/submit-answer", h.SubmitAnswer)
	examsGroup.POST("/:id/finish", h.FinishExam)
	protectedGroup.GET("/exams/my-results/:event_id", h.ReviewAnswersParticipant)
	protectedGroup.GET("/exams/my-results/:event_id/export-pdf", h.ExportReviewAnswersParticipantPDF)
}

func (h *ExamHandler) RegisterAdminRoutes(adminGroup *echo.Group) {
	// Review detail jawaban peserta berdasarkan approval_id
	adminGroup.GET("/exams/approvals/:approval_id/answers", h.ReviewAnswers)
	adminGroup.GET("/exams/approvals/:approval_id/answers/export-pdf", h.ExportReviewAnswersPDF)
}

func getUserIDFromContext(c echo.Context) (uuid.UUID, error) {
	payloadValue := c.Get(appMiddleware.AuthorizationPayloadKey)
	if payloadValue == nil {
		return uuid.UUID{}, fmt.Errorf("tidak terautentikasi")
	}
	payload, ok := payloadValue.(*utils.TokenPayload)
	if !ok {
		return uuid.UUID{}, fmt.Errorf("terjadi kesalahan internal membaca sesi")
	}
	return payload.UserID, nil
}

// ListUpcomingEvents godoc
// @Summary     Daftar Event Mendatang
// @Description Peserta melihat event ujian yang belum berakhir
// @Tags        Peserta - Ujian
// @Security    BearerAuth
// @Produce     json
// @Param       page   query     int  false  "Halaman" default(1)
// @Param       limit  query     int  false  "Limit" default(10)
// @Success     200    {object}  response.PaginatedResponse{data=[]domain.UpcomingEvent}
// @Router      /protected/exams/upcoming [get]
func (h *ExamHandler) ListUpcomingEvents(c echo.Context) error {
	page, limit := response.ParsePaginationParams(c)
	events, total, err := h.service.ListUpcomingEvents(c.Request().Context(), page, limit)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil event mendatang", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	if events == nil {
		events = []domain.UpcomingEvent{}
	}

	meta := response.BuildMeta(page, limit, total)
	return response.SuccessWithMeta(c, http.StatusOK, "Daftar event mendatang berhasil diambil", events, meta)
}

// ListMyExams godoc
// @Summary     Riwayat Ujian Saya
// @Description Peserta melihat daftar pendaftaran & nilai ujian miliknya
// @Tags        Peserta - Ujian
// @Security    BearerAuth
// @Produce     json
// @Success     200  {object}  response.PaginatedResponse{data=[]domain.UserApproval}
// @Router      /protected/exams/my-exams [get]
func (h *ExamHandler) ListMyExams(c echo.Context) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return response.Error(c, http.StatusUnauthorized, "Unauthorized", nil)
	}

	page, limit := response.ParsePaginationParams(c)
	exams, total, err := h.service.ListMyExams(c.Request().Context(), userID, page, limit)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil daftar ujian", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	if exams == nil {
		exams = []domain.UserApproval{}
	}

	meta := response.BuildMeta(page, limit, total)
	return response.SuccessWithMeta(c, http.StatusOK, "Daftar ujian berhasil diambil", exams, meta)
}

// Enroll godoc
// @Summary     Daftar ke Event Ujian
// @Description Peserta mendaftar ke suatu event ujian (status awal: pending)
// @Tags        Peserta - Ujian
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.EnrollEventRequest  true  "ID Event"
// @Success     200   {object}  response.SuccessResponse
// @Router      /protected/exams/enroll [post]
func (h *ExamHandler) Enroll(c echo.Context) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return response.Error(c, http.StatusUnauthorized, "Unauthorized", nil)
	}

	var req domain.EnrollEventRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	err = h.service.Enroll(c.Request().Context(), userID, req.EventID)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "Gagal mendaftar event", []response.ErrorDetail{{Field: "event", Message: err.Error()}})
	}

	if h.broker != nil {
		_ = h.broker.Publish(c.Request().Context(), `{"event":"new_enrollment", "message":"Peserta baru mendaftar ujian"}`)
	}

	return response.Success(c, http.StatusOK, "Berhasil mendaftar, menunggu persetujuan Admin", nil)
}

func (h *ExamHandler) StartExam(c echo.Context) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return response.Error(c, http.StatusUnauthorized, "Unauthorized", nil)
	}

	eventID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID event tidak valid", nil)
	}

	questions, err := h.service.StartExam(c.Request().Context(), userID, eventID)
	if err != nil {
		return response.Error(c, http.StatusForbidden, "Tidak dapat memulai ujian", []response.ErrorDetail{{Field: "exam", Message: err.Error()}})
	}

	if questions == nil {
		questions = []domain.ParticipantQuestion{}
	}

	return response.Success(c, http.StatusOK, "Ujian dimulai", questions)
}

func (h *ExamHandler) SubmitAnswer(c echo.Context) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return response.Error(c, http.StatusUnauthorized, "Unauthorized", nil)
	}

	eventID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID event tidak valid", nil)
	}

	var req domain.SubmitAnswerRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	err = h.service.SubmitAnswer(c.Request().Context(), userID, eventID, req)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "Gagal menyimpan jawaban", []response.ErrorDetail{{Field: "answer", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Jawaban disimpan", nil)
}

func (h *ExamHandler) FinishExam(c echo.Context) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return response.Error(c, http.StatusUnauthorized, "Unauthorized", nil)
	}

	eventID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID event tidak valid", nil)
	}

	res, err := h.service.FinishExam(c.Request().Context(), userID, eventID)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "Gagal menyelesaikan ujian", []response.ErrorDetail{{Field: "exam", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Ujian selesai", res)
}

func (h *ExamHandler) ReviewAnswers(c echo.Context) error {
	approvalID, err := uuid.Parse(c.Param("approval_id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID approval tidak valid", nil)
	}

	answers, err := h.service.ReviewParticipantAnswers(c.Request().Context(), approvalID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil data jawaban peserta", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Detail jawaban peserta berhasil diambil", answers)
}

func (h *ExamHandler) ExportReviewAnswersPDF(c echo.Context) error {
	approvalID, err := uuid.Parse(c.Param("approval_id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID approval tidak valid", nil)
	}

	participantName := c.QueryParam("participant_name")
	eventName := c.QueryParam("event_name")
	scoreStr := c.QueryParam("score")
	passingGradeStr := c.QueryParam("passing_grade")
	isPassedStr := c.QueryParam("is_passed")

	score, _ := strconv.ParseFloat(scoreStr, 64)
	passingGrade, _ := strconv.ParseFloat(passingGradeStr, 64)
	isPassed := isPassedStr == "true"

	pdfBytes, err := h.service.ExportReviewAnswersPDF(c.Request().Context(), approvalID, participantName, eventName, score, passingGrade, isPassed)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal export PDF review jawaban", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	c.Response().Header().Set("Content-Type", "application/pdf")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"PramukaCAT - Review Jawaban %s.pdf\"", participantName))

	return c.Blob(http.StatusOK, "application/pdf", pdfBytes)
}

// ReviewAnswersParticipant godoc
// @Summary     Lihat Hasil Ujian Peserta
// @Description Peserta melihat hasil ujian (skor, soal, jawaban, kunci jawaban) setelah menyelesaikan ujian
// @Tags        Peserta - Ujian
// @Security    BearerAuth
// @Param       event_id path     string  true  "UUID Event"
// @Success     200      {object} response.SuccessResponse
// @Failure     400      {object} response.ErrorResponse
// @Router      /protected/exams/my-results/{event_id} [get]
func (h *ExamHandler) ReviewAnswersParticipant(c echo.Context) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return response.Error(c, http.StatusUnauthorized, err.Error(), nil)
	}

	eventID, err := uuid.Parse(c.Param("event_id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID event tidak valid", nil)
	}

	answers, err := h.service.ReviewParticipantAnswersByEvent(c.Request().Context(), userID, eventID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil data hasil ujian", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Detail hasil ujian berhasil diambil", answers)
}

func (h *ExamHandler) ExportReviewAnswersParticipantPDF(c echo.Context) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return response.Error(c, http.StatusUnauthorized, err.Error(), nil)
	}

	eventID, err := uuid.Parse(c.Param("event_id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID event tidak valid", nil)
	}

	participantName := c.QueryParam("participant_name")
	eventName := c.QueryParam("event_name")
	scoreStr := c.QueryParam("score")
	passingGradeStr := c.QueryParam("passing_grade")
	isPassedStr := c.QueryParam("is_passed")

	score, _ := strconv.ParseFloat(scoreStr, 64)
	passingGrade, _ := strconv.ParseFloat(passingGradeStr, 64)
	isPassed := isPassedStr == "true"

	pdfBytes, err := h.service.ExportReviewAnswersByEventPDF(c.Request().Context(), userID, eventID, participantName, eventName, score, passingGrade, isPassed)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal export PDF review jawaban", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	c.Response().Header().Set("Content-Type", "application/pdf")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"PramukaCAT - Hasil Ujian %s.pdf\"", participantName))

	return c.Blob(http.StatusOK, "application/pdf", pdfBytes)
}
