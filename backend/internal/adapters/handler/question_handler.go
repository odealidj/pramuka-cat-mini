package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jung-kurt/gofpdf"
	"github.com/labstack/echo/v4"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/response"
	"github.com/xuri/excelize/v2"
)

type QuestionHandler struct {
	service ports.QuestionService
}

func NewQuestionHandler(service ports.QuestionService) *QuestionHandler {
	return &QuestionHandler{service: service}
}

func (h *QuestionHandler) RegisterAdminRoutes(adminGroup *echo.Group) {
	questionsGroup := adminGroup.Group("/questions")
	questionsGroup.POST("", h.CreateQuestion)
	questionsGroup.GET("", h.ListQuestions)
	questionsGroup.GET("/export/excel", h.ExportQuestionsExcel)
	questionsGroup.GET("/export/pdf", h.ExportQuestionsPDF)
	questionsGroup.GET("/:id", h.GetQuestion)
	questionsGroup.PUT("/:id", h.UpdateQuestion)
	questionsGroup.DELETE("/:id", h.DeleteQuestion)
	questionsGroup.POST("/import/preview", h.PreviewImport)
	questionsGroup.POST("/import/confirm", h.ConfirmImport)
	questionsGroup.GET("/import/template", h.ExportQuestionTemplate)
}

// CreateQuestion godoc
// @Summary     Buat Soal Baru
// @Tags        Admin - Bank Soal
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.CreateQuestionRequest  true  "Data Soal"
// @Success     201   {object}  response.SuccessResponse{data=domain.Question}
// @Router      /admin/questions [post]
func (h *QuestionHandler) CreateQuestion(c echo.Context) error {
	var req domain.CreateQuestionRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	q, err := h.service.CreateQuestion(c.Request().Context(), req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errMsg := "Gagal membuat pertanyaan"
		if err.Error() == "soal dengan pertanyaan serupa sudah terdaftar" || err.Error() == "teks pertanyaan tidak boleh kosong" {
			statusCode = http.StatusBadRequest
			errMsg = err.Error()
		}
		return response.Error(c, statusCode, errMsg, []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusCreated, "Pertanyaan berhasil dibuat", q)
}

// ListQuestions godoc
// @Summary     Daftar Soal
// @Tags        Admin - Bank Soal
// @Security    BearerAuth
// @Produce     json
// @Param       page   query     int  false  "Halaman" default(1)
// @Param       limit  query     int  false  "Limit" default(10)
// @Param       search query     string false "Cari teks pertanyaan"
// @Success     200    {object}  response.PaginatedResponse{data=[]domain.Question}
// @Router      /admin/questions [get]
func (h *QuestionHandler) ListQuestions(c echo.Context) error {
	page, limit := response.ParsePaginationParams(c)
	search := c.QueryParam("search")
	var categoryId *int32
	if catStr := c.QueryParam("category_id"); catStr != "" {
		var cat int
		_, err := fmt.Sscanf(catStr, "%d", &cat)
		if err == nil {
			cInt := int32(cat)
			categoryId = &cInt
		}
	}
	questions, total, err := h.service.ListQuestions(c.Request().Context(), page, limit, search, categoryId)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil daftar pertanyaan", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	if questions == nil {
		questions = []domain.Question{}
	}

	meta := response.BuildMeta(page, limit, total)
	return response.SuccessWithMeta(c, http.StatusOK, "Daftar pertanyaan berhasil diambil", questions, meta)
}

// GetQuestion godoc
// @Summary     Detail Soal
// @Tags        Admin - Bank Soal
// @Security    BearerAuth
// @Produce     json
// @Param       id   path      string  true  "UUID Soal"
// @Success     200  {object}  response.SuccessResponse{data=domain.Question}
// @Router      /admin/questions/{id} [get]
func (h *QuestionHandler) GetQuestion(c echo.Context) error {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID pertanyaan tidak valid", nil)
	}

	q, err := h.service.GetQuestionById(c.Request().Context(), id)
	if err != nil {
		return response.Error(c, http.StatusNotFound, "Pertanyaan tidak ditemukan", nil)
	}

	return response.Success(c, http.StatusOK, "Pertanyaan berhasil diambil", q)
}

// UpdateQuestion godoc
// @Summary     Update Soal
// @Tags        Admin - Bank Soal
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       id    path      string                       true  "UUID Soal"
// @Param       body  body      domain.UpdateQuestionRequest  true  "Data Soal Baru"
// @Success     200   {object}  response.SuccessResponse{data=domain.Question}
// @Router      /admin/questions/{id} [put]
func (h *QuestionHandler) UpdateQuestion(c echo.Context) error {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID pertanyaan tidak valid", nil)
	}

	var req domain.UpdateQuestionRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	q, err := h.service.UpdateQuestion(c.Request().Context(), id, req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errMsg := "Gagal memperbarui pertanyaan"
		if err.Error() == "soal dengan pertanyaan serupa sudah terdaftar" {
			statusCode = http.StatusBadRequest
			errMsg = err.Error()
		}
		return response.Error(c, statusCode, errMsg, []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Pertanyaan berhasil diperbarui", q)
}

// DeleteQuestion godoc
// @Summary     Hapus Soal
// @Tags        Admin - Bank Soal
// @Security    BearerAuth
// @Produce     json
// @Param       id   path      string  true  "UUID Soal"
// @Success     200  {object}  response.SuccessResponse
// @Router      /admin/questions/{id} [delete]
func (h *QuestionHandler) DeleteQuestion(c echo.Context) error {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID pertanyaan tidak valid", nil)
	}

	err = h.service.DeleteQuestion(c.Request().Context(), id)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menghapus pertanyaan", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Pertanyaan berhasil dihapus", nil)
}

// PreviewImport godoc
// @Summary     Preview Import Soal via Excel
// @Tags        Admin - Bank Soal
// @Security    BearerAuth
// @Accept      mpfd
// @Produce     json
// @Param       file formData file true "File Excel (.xlsx)"
// @Success     200  {object}  response.SuccessResponse{data=domain.ImportQuestionsPreviewResponse}
// @Router      /admin/questions/import/preview [post]
func (h *QuestionHandler) PreviewImport(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "File tidak ditemukan dalam request", nil)
	}

	src, err := file.Open()
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal membuka file upload", nil)
	}
	defer src.Close()

	// Baca seluruh byte file ke memori
	fileData := make([]byte, file.Size)
	_, err = src.Read(fileData)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal membaca isi file", nil)
	}

	res, err := h.service.PreviewImportExcel(c.Request().Context(), fileData)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, err.Error(), nil)
	}

	// Walaupun ada yang error per baris, kita tetap merespons 200 OK karena API berhasil memproses validasi,
	// Namun kita beri response kode khusus (misal 422) jika errorRows > 0 sesuai kesepakatan agar mudah dibaca Frontend
	if res.ErrorRows > 0 {
		return c.JSON(http.StatusUnprocessableEntity, map[string]interface{}{
			"status":  "error",
			"message": "Terdapat baris data yang tidak valid. Silakan periksa kembali.",
			"data":    res,
		})
	}

	return response.Success(c, http.StatusOK, "Preview file berhasil divalidasi", res)
}

// ConfirmImport godoc
// @Summary     Konfirmasi Simpan Import Soal
// @Tags        Admin - Bank Soal
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body body domain.ConfirmImportRequest true "Data Soal Valid"
// @Success     200  {object}  response.SuccessResponse
// @Router      /admin/questions/import/confirm [post]
func (h *QuestionHandler) ConfirmImport(c echo.Context) error {
	var req domain.ConfirmImportRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format JSON tidak valid", nil)
	}

	count, err := h.service.ConfirmImportExcel(c.Request().Context(), req)
	if err != nil {
		fmt.Printf("ERROR Import: %v\n", err)
		return response.Error(c, http.StatusInternalServerError, "Gagal menyimpan import", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	msg := fmt.Sprintf("%d soal berhasil di-import", count)
	return response.Success(c, http.StatusCreated, msg, nil)
}

// ExportQuestionTemplate godoc
// @Summary     Download Template Excel Import Soal
// @Tags        Admin - Bank Soal
// @Security    BearerAuth
// @Produce     application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
// @Success     200  {file}    file
// @Router      /admin/questions/import/template [get]
func (h *QuestionHandler) ExportQuestionTemplate(c echo.Context) error {
	buf, err := h.service.DownloadTemplateExcel(c.Request().Context())
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal membuat template", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	c.Response().Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=\"template-soal-pramuka.xlsx\"")

	return c.Blob(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf)
}

func (h *QuestionHandler) ExportQuestionsExcel(c echo.Context) error {
	search := c.QueryParam("search")
	var categoryId *int32
	if catStr := c.QueryParam("category_id"); catStr != "" {
		var cat int
		_, err := fmt.Sscanf(catStr, "%d", &cat)
		if err == nil {
			cInt := int32(cat)
			categoryId = &cInt
		}
	}

	questions, _, err := h.service.ListQuestions(c.Request().Context(), 1, 1000000, search, categoryId)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memuat soal", nil)
	}

	f := excelize.NewFile()
	sheetName := "Bank Soal"
	f.SetSheetName("Sheet1", sheetName)

	f.SetCellValue(sheetName, "A1", "PramukaCAT - Daftar Bank Soal")
	f.MergeCell(sheetName, "A1", "H1")
	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 14, Color: "5C3410"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheetName, "A1", "H1", titleStyle)
	f.SetRowHeight(sheetName, 1, 22)

	f.MergeCell(sheetName, "A2", "H2")
	f.SetCellValue(sheetName, "A2", fmt.Sprintf("Dicetak pada: %s", time.Now().In(time.Local).Format("02 January 2006 15:04")))
	dateStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Italic: true, Color: "7A4520"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheetName, "A2", "H2", dateStyle)
	f.SetRowHeight(sheetName, 2, 16)

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"9C5A22"}, Pattern: 1},
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	dataStyle, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
	})

	headers := []string{"Kategori ID", "Teks Soal", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci Jawaban", "Bobot Nilai"}
	for i, header := range headers {
		col := string(rune('A'+i)) + "3"
		f.SetCellValue(sheetName, col, header)
	}
	f.SetCellStyle(sheetName, "A3", "H3", headerStyle)

	// Set Lebar Kolom agar lebih rapi
	f.SetColWidth(sheetName, "A", "A", 15)
	f.SetColWidth(sheetName, "B", "B", 40)
	f.SetColWidth(sheetName, "C", "F", 25)
	f.SetColWidth(sheetName, "G", "G", 15)
	f.SetColWidth(sheetName, "H", "H", 15)

	for i, q := range questions {
		row := i + 4
		catID := ""
		if q.CategoryID != nil {
			catID = fmt.Sprintf("%d", *q.CategoryID)
		}
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), catID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), q.QuestionText)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), q.OptionA)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), q.OptionB)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), q.OptionC)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), q.OptionD)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), q.CorrectAnswer)
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), q.Weight)
		f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("H%d", row), dataStyle)
	}

	c.Response().Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=\"PramukaCAT - Bank Soal.xlsx\"")

	return f.Write(c.Response().Writer)
}

func (h *QuestionHandler) ExportQuestionsPDF(c echo.Context) error {
	search := c.QueryParam("search")
	var categoryId *int32
	if catStr := c.QueryParam("category_id"); catStr != "" {
		var cat int
		_, err := fmt.Sscanf(catStr, "%d", &cat)
		if err == nil {
			cInt := int32(cat)
			categoryId = &cInt
		}
	}

	questions, _, err := h.service.ListQuestions(c.Request().Context(), 1, 1000000, search, categoryId)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memuat soal", nil)
	}

	pdf := gofpdf.New("P", "mm", "A4", "")

	// Set Footer untuk menampilkan nomor halaman
	pdf.SetFooterFunc(func() {
		pdf.SetY(-15)
		pdf.SetFont("Arial", "I", 9)
		pdf.SetTextColor(128, 128, 128)
		pdf.CellFormat(0, 10, fmt.Sprintf("Halaman %d", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	pdf.AddPage()

	// Title
	pdf.SetFont("Arial", "B", 16)
	pdf.SetTextColor(92, 52, 16) // #5C3410
	pdf.CellFormat(190, 10, "PramukaCAT - Daftar Bank Soal", "", 1, "C", false, 0, "")

	// SubTitle
	pdf.SetFont("Arial", "I", 11)
	pdf.SetTextColor(122, 69, 32) // #7A4520
	pdf.CellFormat(190, 7, fmt.Sprintf("Dicetak pada: %s", time.Now().In(time.Local).Format("02 January 2006 15:04")), "", 1, "C", false, 0, "")
	pdf.Ln(8)

	// Header Style
	pdf.SetFont("Arial", "B", 10)
	pdf.SetFillColor(156, 90, 34) // Dark Brown
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(10, 10, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 10, "Kat ID", "1", 0, "C", true, 0, "")
	pdf.CellFormat(140, 10, "Teks Soal", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 10, "Kunci", "1", 0, "C", true, 0, "")
	pdf.Ln(-1)

	// Reset text color for data
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 10)

	for i, q := range questions {
		// Alternating row color
		if i%2 == 0 {
			pdf.SetFillColor(255, 255, 255) // White
		} else {
			pdf.SetFillColor(249, 244, 240) // Light Brown
		}

		// Calculate height for text wrapping
		lines := pdf.SplitText(q.QuestionText, 140)
		h := float64(len(lines)) * 6
		if h < 10 {
			h = 10
		}
		
		// Get current Y, check if need page break
		if pdf.GetY()+h > 270 {
			pdf.AddPage()
		}
		
		x, y := pdf.GetXY()
		
		pdf.Rect(x, y, 10, h, "DF")
		pdf.SetXY(x, y+(h-6)/2)
		pdf.CellFormat(10, 6, fmt.Sprintf("%d", i+1), "", 0, "C", false, 0, "")
		
		pdf.SetXY(x+10, y)
		pdf.Rect(x+10, y, 20, h, "DF")
		pdf.SetXY(x+10, y+(h-6)/2)
		catID := ""
		if q.CategoryID != nil {
			catID = fmt.Sprintf("%d", *q.CategoryID)
		}
		pdf.CellFormat(20, 6, catID, "", 0, "C", false, 0, "")
		
		pdf.SetXY(x+30, y)
		pdf.Rect(x+30, y, 140, h, "DF")
		pdf.MultiCell(140, 6, q.QuestionText, "", "L", false)
		
		pdf.SetXY(x+170, y)
		pdf.Rect(x+170, y, 20, h, "DF")
		pdf.SetXY(x+170, y+(h-6)/2)
		pdf.CellFormat(20, 6, q.CorrectAnswer, "", 0, "C", false, 0, "")
		
		pdf.SetXY(x, y+h)
	}

	c.Response().Header().Set("Content-Type", "application/pdf")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=Bank_Soal.pdf")

	return pdf.Output(c.Response().Writer)
}
