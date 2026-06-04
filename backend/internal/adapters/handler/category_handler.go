package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
	"github.com/labstack/echo/v4"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/response"
	"github.com/xuri/excelize/v2"
)

type CategoryHandler struct {
	service ports.CategoryService
}

func NewCategoryHandler(service ports.CategoryService) *CategoryHandler {
	return &CategoryHandler{service: service}
}

func (h *CategoryHandler) RegisterAdminRoutes(adminGroup *echo.Group) {
	categoriesGroup := adminGroup.Group("/categories")
	categoriesGroup.POST("", h.CreateCategory)
	categoriesGroup.GET("", h.ListCategories)
	categoriesGroup.GET("/export/excel", h.ExportCategoriesExcel)
	categoriesGroup.GET("/export/pdf", h.ExportCategoriesPDF)
	categoriesGroup.PUT("/:id", h.UpdateCategory)
	categoriesGroup.DELETE("/:id", h.DeleteCategory)
}

// CreateCategory godoc
// @Summary     Buat Kategori Soal
// @Tags        Admin - Kategori
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.CreateCategoryRequest  true  "Nama Kategori"
// @Success     201   {object}  response.SuccessResponse{data=domain.Category}
// @Router      /admin/categories [post]
func (h *CategoryHandler) CreateCategory(c echo.Context) error {
	var req domain.CreateCategoryRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	category, err := h.service.CreateCategory(c.Request().Context(), req)
	if err != nil {
		if strings.Contains(err.Error(), "kosong") || strings.Contains(err.Error(), "sudah ada") {
			return response.Error(c, http.StatusBadRequest, err.Error(), nil)
		}
		return response.Error(c, http.StatusInternalServerError, "Gagal membuat kategori", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusCreated, "Kategori berhasil dibuat", category)
}

// ListCategories godoc
// @Summary     Daftar Kategori Soal
// @Tags        Admin - Kategori
// @Security    BearerAuth
// @Produce     json
// @Param       page   query     int  false  "Halaman" default(1)
// @Param       limit  query     int  false  "Limit" default(10)
// @Param       search query     string false "Cari nama kategori"
// @Success     200    {object}  response.PaginatedResponse{data=[]domain.Category}
// @Router      /admin/categories [get]
func (h *CategoryHandler) ListCategories(c echo.Context) error {
	page, limit := response.ParsePaginationParams(c)
	search := c.QueryParam("search")
	categories, total, err := h.service.ListCategories(c.Request().Context(), page, limit, search)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil daftar kategori", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	if categories == nil {
		categories = []domain.Category{}
	}

	meta := response.BuildMeta(page, limit, total)
	return response.SuccessWithMeta(c, http.StatusOK, "Daftar kategori berhasil diambil", categories, meta)
}

// UpdateCategory godoc
// @Summary     Update Kategori Soal
// @Tags        Admin - Kategori
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       id    path      int                           true  "ID Kategori"
// @Param       body  body      domain.UpdateCategoryRequest  true  "Nama Baru"
// @Success     200   {object}  response.SuccessResponse{data=domain.Category}
// @Router      /admin/categories/{id} [put]
func (h *CategoryHandler) UpdateCategory(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID kategori tidak valid", nil)
	}

	var req domain.UpdateCategoryRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	category, err := h.service.UpdateCategory(c.Request().Context(), int32(id), req)
	if err != nil {
		if strings.Contains(err.Error(), "kosong") || strings.Contains(err.Error(), "sudah ada") || strings.Contains(err.Error(), "tidak ditemukan") {
			return response.Error(c, http.StatusBadRequest, err.Error(), nil)
		}
		return response.Error(c, http.StatusInternalServerError, "Gagal memperbarui kategori", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Kategori berhasil diperbarui", category)
}

// DeleteCategory godoc
// @Summary     Hapus Kategori Soal
// @Tags        Admin - Kategori
// @Security    BearerAuth
// @Produce     json
// @Param       id   path      int  true  "ID Kategori"
// @Success     200  {object}  response.SuccessResponse
// @Router      /admin/categories/{id} [delete]
func (h *CategoryHandler) DeleteCategory(c echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID kategori tidak valid", nil)
	}

	err = h.service.DeleteCategory(c.Request().Context(), int32(id))
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menghapus kategori", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Kategori berhasil dihapus", nil)
}

func (h *CategoryHandler) ExportCategoriesExcel(c echo.Context) error {
	categories, _, err := h.service.ListCategories(c.Request().Context(), 1, 1000000, "")
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memuat kategori", nil)
	}

	f := excelize.NewFile()
	sheetName := "Kategori Soal"
	f.SetSheetName("Sheet1", sheetName)

	f.SetCellValue(sheetName, "A1", "PramukaCAT - Daftar Kategori Soal")
	f.MergeCell(sheetName, "A1", "D1")
	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 14, Color: "5C3410"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheetName, "A1", "D1", titleStyle)
	f.SetRowHeight(sheetName, 1, 22)

	f.MergeCell(sheetName, "A2", "D2")
	f.SetCellValue(sheetName, "A2", fmt.Sprintf("Dicetak pada: %s", time.Now().In(time.Local).Format("02 January 2006 15:04")))
	dateStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Italic: true, Color: "7A4520"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheetName, "A2", "D2", dateStyle)
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

	headers := []string{"No", "ID", "Nama Kategori", "Jumlah Soal"}
	for i, header := range headers {
		col := string(rune('A'+i)) + "3"
		f.SetCellValue(sheetName, col, header)
	}
	f.SetCellStyle(sheetName, "A3", "D3", headerStyle)

	f.SetColWidth(sheetName, "A", "A", 10)
	f.SetColWidth(sheetName, "B", "B", 15)
	f.SetColWidth(sheetName, "C", "C", 40)
	f.SetColWidth(sheetName, "D", "D", 20)

	for i, cat := range categories {
		row := i + 4
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), cat.ID)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), cat.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), cat.QuestionCount)
		f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("D%d", row), dataStyle)
	}

	c.Response().Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=\"PramukaCAT - Kategori Soal.xlsx\"")

	return f.Write(c.Response().Writer)
}

func (h *CategoryHandler) ExportCategoriesPDF(c echo.Context) error {
	categories, _, err := h.service.ListCategories(c.Request().Context(), 1, 1000000, "")
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memuat kategori", nil)
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
	pdf.CellFormat(190, 10, "PramukaCAT - Daftar Kategori Soal", "", 1, "C", false, 0, "")

	// SubTitle
	pdf.SetFont("Arial", "I", 11)
	pdf.SetTextColor(122, 69, 32) // #7A4520
	pdf.CellFormat(190, 7, fmt.Sprintf("Dicetak pada: %s", time.Now().In(time.Local).Format("02 January 2006 15:04")), "", 1, "C", false, 0, "")
	pdf.Ln(8)

	// Headers
	pdf.SetFont("Arial", "B", 12)
	pdf.SetFillColor(156, 90, 34)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(15, 10, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 10, "ID", "1", 0, "C", true, 0, "")
	pdf.CellFormat(115, 10, "Nama Kategori", "1", 0, "C", true, 0, "")
	pdf.CellFormat(40, 10, "Jumlah Soal", "1", 0, "C", true, 0, "")
	pdf.Ln(-1)

	// Rows
	pdf.SetFont("Arial", "", 12)
	pdf.SetTextColor(0, 0, 0)
	for i, cat := range categories {
		if i%2 == 0 {
			pdf.SetFillColor(255, 255, 255)
		} else {
			pdf.SetFillColor(249, 244, 240)
		}
		pdf.CellFormat(15, 10, fmt.Sprintf("%d", i+1), "1", 0, "C", true, 0, "")
		pdf.CellFormat(20, 10, fmt.Sprintf("%d", cat.ID), "1", 0, "C", true, 0, "")
		pdf.CellFormat(115, 10, cat.Name, "1", 0, "L", true, 0, "")
		pdf.CellFormat(40, 10, fmt.Sprintf("%d", cat.QuestionCount), "1", 0, "C", true, 0, "")
		pdf.Ln(-1)
	}

	c.Response().Header().Set("Content-Type", "application/pdf")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=\"PramukaCAT - Kategori_Soal.pdf\"")

	return pdf.Output(c.Response().Writer)
}
