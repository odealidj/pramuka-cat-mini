package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/odealidj/pramuka-CAT/backend/pkg/response"
)

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

// UploadImage godoc
// @Summary     Unggah Gambar
// @Description Mengunggah gambar (profil) ke local storage
// @Tags        Admin - Upload
// @Security    BearerAuth
// @Accept      multipart/form-data
// @Produce     json
// @Param       file formData file true "File Gambar (WebP/JPG/PNG)"
// @Success     200   {object} response.SuccessResponse
// @Failure     400   {object} response.ErrorResponse
// @Router      /admin/upload/image [post]
func (h *UploadHandler) UploadImage(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		fmt.Printf("FormFile error: %v\n", err)
		return response.Error(c, http.StatusBadRequest, "Gagal membaca file unggahan", nil)
	}

	// Batasi ukuran (meskipun frontend sudah kompres, kita validasi juga di backend)
	// Misal max 2MB (2 * 1024 * 1024)
	if file.Size > 2*1024*1024 {
		fmt.Printf("File size error: %d\n", file.Size)
		return response.Error(c, http.StatusBadRequest, "Ukuran file maksimal 2MB", nil)
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	fmt.Printf("File ext: %s, Filename: %s\n", ext, file.Filename)
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		fmt.Printf("Invalid ext error: %s\n", ext)
		return response.Error(c, http.StatusBadRequest, "Format file tidak didukung (harus JPG/PNG/WebP)", nil)
	}

	src, err := file.Open()
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memproses file", nil)
	}
	defer src.Close()

	// Pastikan folder uploads ada
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal membuat direktori upload", nil)
	}

	// Gunakan UUID untuk mencegah duplikasi nama
	newFileName := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	dstPath := filepath.Join(uploadDir, newFileName)

	dst, err := os.Create(dstPath)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menyimpan file", nil)
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menulis file", nil)
	}

	// Kembalikan URL relatif
	photoURL := "/uploads/" + newFileName

	return response.Success(c, http.StatusOK, "File berhasil diunggah", map[string]string{
		"url": photoURL,
	})
}
