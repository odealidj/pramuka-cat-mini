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
	appMiddleware "github.com/odealidj/pramuka-CAT/backend/internal/adapters/middleware"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/response"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
)

type UserHandler struct {
	service ports.UserService
}

func NewUserHandler(service ports.UserService) *UserHandler {
	return &UserHandler{service: service}
}

func (h *UserHandler) RegisterAdminRoutes(adminGroup *echo.Group) {
	usersGroup := adminGroup.Group("/users")
	usersGroup.POST("", h.CreatePesertaOnly)
	usersGroup.GET("", h.ListUsers) // Lists only peserta
	usersGroup.GET("/:id", h.GetUser)
	usersGroup.PUT("/:id", h.UpdateUser) // Admin can only update peserta
	usersGroup.PUT("/:id/password", h.UpdateUserPassword)
	usersGroup.DELETE("/:id", h.DeleteUser)
}

func (h *UserHandler) RegisterSuperAdminRoutes(superAdminGroup *echo.Group) {
	adminGroup := superAdminGroup.Group("/admins")
	adminGroup.POST("", h.CreateAdminOnly)
	adminGroup.GET("", h.ListAdmins)
	adminGroup.GET("/:id", h.GetUser)
	adminGroup.PUT("/:id", h.UpdateUser) // Super admin updates admin
	adminGroup.PUT("/:id/password", h.UpdateUserPassword)
	adminGroup.DELETE("/:id", h.DeleteUser)
}

func (h *UserHandler) RegisterParticipantRoutes(participantGroup *echo.Group) {
	usersGroup := participantGroup.Group("/users")
	usersGroup.GET("/me", h.GetMyProfile)
	usersGroup.POST("/me/photo", h.UploadPhoto)
	usersGroup.PUT("/me", h.UpdateProfile)
	usersGroup.PUT("/me/password", h.ChangePassword)
}

// CreatePesertaOnly godoc
// @Summary     Buat Peserta Baru
// @Description Admin membuat akun peserta baru
// @Tags        Admin - User
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.CreateUserRequest  true  "Data Peserta Baru"
// @Success     201   {object}  response.SuccessResponse{data=domain.User}
// @Failure     400   {object}  response.ErrorResponse
// @Failure     500   {object}  response.ErrorResponse
// @Router      /admin/users [post]
func (h *UserHandler) CreatePesertaOnly(c echo.Context) error {
	var req domain.CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	req.Role = appMiddleware.RolePeserta // Paksa role jadi peserta

	u, err := h.service.CreateUser(c.Request().Context(), req)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal membuat peserta", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusCreated, "Peserta berhasil dibuat", u)
}

// CreateAdminOnly godoc
// @Summary     Buat Admin Baru
// @Description Super Admin membuat akun admin baru
// @Tags        Super Admin - Admin
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.CreateUserRequest  true  "Data Admin Baru"
// @Success     201   {object}  response.SuccessResponse{data=domain.User}
// @Failure     400   {object}  response.ErrorResponse
// @Failure     500   {object}  response.ErrorResponse
// @Router      /super-admin/admins [post]
func (h *UserHandler) CreateAdminOnly(c echo.Context) error {
	var req domain.CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	req.Role = appMiddleware.RoleAdmin // Paksa role jadi admin

	u, err := h.service.CreateUser(c.Request().Context(), req)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal membuat admin", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusCreated, "Admin berhasil dibuat", u)
}

// ListUsers godoc
// @Summary     Daftar Semua User
// @Description Mengambil daftar seluruh pengguna dengan paginasi
// @Tags        Admin - User
// @Security    BearerAuth
// @Produce     json
// @Param       page   query     int  false  "Halaman (default: 1)" default(1)
// @Param       limit  query     int  false  "Jumlah per halaman (default: 10)" default(10)
// @Param       search query     string false "Cari nama pengguna"
// @Success     200    {object}  response.PaginatedResponse{data=[]domain.User}
// @Router      /admin/users [get]
func (h *UserHandler) ListUsers(c echo.Context) error {
	page, limit := response.ParsePaginationParams(c)
	search := c.QueryParam("search")
	users, total, err := h.service.ListUsers(c.Request().Context(), page, limit, search)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil daftar user", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	if users == nil {
		users = []domain.User{}
	}

	meta := response.BuildMeta(page, limit, total)
	return response.SuccessWithMeta(c, http.StatusOK, "Daftar peserta berhasil diambil", users, meta)
}

// ListAdmins godoc
// @Summary     Daftar Semua Admin
// @Description Mengambil daftar seluruh admin dengan paginasi
// @Tags        Super Admin - Admin
// @Security    BearerAuth
// @Produce     json
// @Param       page   query     int  false  "Halaman (default: 1)" default(1)
// @Param       limit  query     int  false  "Jumlah per halaman (default: 10)" default(10)
// @Param       search query     string false "Cari nama admin"
// @Success     200    {object}  response.PaginatedResponse{data=[]domain.User}
// @Router      /super-admin/admins [get]
func (h *UserHandler) ListAdmins(c echo.Context) error {
	page, limit := response.ParsePaginationParams(c)
	search := c.QueryParam("search")
	admins, total, err := h.service.ListAdmins(c.Request().Context(), page, limit, search)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal mengambil daftar admin", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	if admins == nil {
		admins = []domain.User{}
	}

	meta := response.BuildMeta(page, limit, total)
	return response.SuccessWithMeta(c, http.StatusOK, "Daftar admin berhasil diambil", admins, meta)
}

// GetUser godoc
// @Summary     Detail User
// @Description Mengambil data detail satu pengguna berdasarkan ID
// @Tags        Admin - User
// @Security    BearerAuth
// @Produce     json
// @Param       id   path      string  true  "UUID User"
// @Success     200  {object}  response.SuccessResponse{data=domain.User}
// @Failure     404  {object}  response.ErrorResponse
// @Router      /admin/users/{id} [get]
func (h *UserHandler) GetUser(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID user tidak valid", nil)
	}

	u, err := h.service.GetUserById(c.Request().Context(), id)
	if err != nil {
		return response.Error(c, http.StatusNotFound, "User tidak ditemukan", nil)
	}

	return response.Success(c, http.StatusOK, "User berhasil diambil", u)
}

// UpdateUser godoc
// @Summary     Update Data User
// @Description Admin memperbarui data profil pengguna
// @Tags        Admin - User
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       id    path      string                   true  "UUID User"
// @Param       body  body      domain.UpdateUserRequest  true  "Data yang diperbarui"
// @Success     200   {object}  response.SuccessResponse{data=domain.User}
// @Failure     400   {object}  response.ErrorResponse
// @Router      /admin/users/{id} [put]
func (h *UserHandler) UpdateUser(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID user tidak valid", nil)
	}

	var req domain.UpdateUserRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	u, err := h.service.UpdateUser(c.Request().Context(), id, req)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memperbarui user", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "User berhasil diperbarui", u)
}

// UpdateUserPassword godoc
// @Summary     Update Password User
// @Description Admin mengubah kata sandi pengguna
// @Tags        Admin - User
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       id    path      string                           true  "UUID User"
// @Param       body  body      domain.UpdateUserPasswordRequest  true  "Password Baru"
// @Success     200   {object}  response.SuccessResponse
// @Failure     400   {object}  response.ErrorResponse
// @Router      /admin/users/{id}/password [put]
func (h *UserHandler) UpdateUserPassword(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID user tidak valid", nil)
	}

	var req domain.UpdateUserPasswordRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	err = h.service.UpdateUserPassword(c.Request().Context(), id, req)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memperbarui kata sandi user", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Kata sandi user berhasil diperbarui", nil)
}

// GetMyProfile godoc
// @Summary     Lihat Profil Saya
// @Description Mengambil profil peserta yang sedang login
// @Tags        User - Profile
// @Security    BearerAuth
// @Produce     json
// @Success     200  {object}  response.SuccessResponse{data=domain.User}
// @Failure     401  {object}  response.ErrorResponse
// @Router      /protected/users/me [get]
func (h *UserHandler) GetMyProfile(c echo.Context) error {
	payloadValue := c.Get(appMiddleware.AuthorizationPayloadKey)
	if payloadValue == nil {
		return response.Error(c, http.StatusUnauthorized, "Tidak terautentikasi", nil)
	}

	payload, ok := payloadValue.(*utils.TokenPayload)
	if !ok {
		return response.Error(c, http.StatusInternalServerError, "Terjadi kesalahan internal", nil)
	}

	user, err := h.service.GetUserById(c.Request().Context(), payload.UserID)
	if err != nil {
		return response.Error(c, http.StatusNotFound, "Profil tidak ditemukan", nil)
	}

	return response.Success(c, http.StatusOK, "Berhasil mengambil profil", user)
}

// UpdateProfile godoc
// @Summary     Update Profil Sendiri
// @Description Pengguna memperbarui data profilnya sendiri
// @Tags        User
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.UpdateProfileRequest  true  "Data yang diperbarui"
// @Success     200   {object}  response.SuccessResponse{data=domain.User}
// @Failure     400   {object}  response.ErrorResponse
// @Router      /protected/users/me [put]
func (h *UserHandler) UpdateProfile(c echo.Context) error {
	payloadValue := c.Get(appMiddleware.AuthorizationPayloadKey)
	if payloadValue == nil {
		return response.Error(c, http.StatusUnauthorized, "Tidak terautentikasi", nil)
	}
	payload, ok := payloadValue.(*utils.TokenPayload)
	if !ok {
		return response.Error(c, http.StatusInternalServerError, "Terjadi kesalahan internal membaca sesi", nil)
	}

	var req domain.UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	u, err := h.service.UpdateProfile(c.Request().Context(), payload.UserID, req)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memperbarui profil", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Profil berhasil diperbarui", u)
}

// ChangePassword godoc
// @Summary     Ganti Kata Sandi Sendiri
// @Description Pengguna mengganti kata sandi mereka sendiri
// @Tags        User
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.UpdateProfilePasswordRequest  true  "Kata Sandi Lama & Baru"
// @Success     200   {object}  response.SuccessResponse
// @Failure     400   {object}  response.ErrorResponse
// @Router      /protected/users/me/password [put]
func (h *UserHandler) ChangePassword(c echo.Context) error {
	payloadValue := c.Get(appMiddleware.AuthorizationPayloadKey)
	if payloadValue == nil {
		return response.Error(c, http.StatusUnauthorized, "Tidak terautentikasi", nil)
	}
	payload, ok := payloadValue.(*utils.TokenPayload)
	if !ok {
		return response.Error(c, http.StatusInternalServerError, "Terjadi kesalahan internal membaca sesi", nil)
	}

	var req domain.UpdateProfilePasswordRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	err := h.service.ChangePassword(c.Request().Context(), payload.UserID, req)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, err.Error(), nil)
	}

	return response.Success(c, http.StatusOK, "Kata sandi berhasil diperbarui", nil)
}

// DeleteUser godoc
// @Summary     Hapus User (Soft-Delete)
// @Description Admin menonaktifkan akun pengguna (data tidak benar-benar dihapus)
// @Tags        Admin - User
// @Security    BearerAuth
// @Produce     json
// @Param       id   path      string  true  "UUID User"
// @Success     200  {object}  response.SuccessResponse
// @Failure     404  {object}  response.ErrorResponse
// @Router      /admin/users/{id} [delete]
func (h *UserHandler) DeleteUser(c echo.Context) error {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "ID user tidak valid", nil)
	}

	err = h.service.DeleteUser(c.Request().Context(), id)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menghapus user", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "User berhasil dihapus", nil)
}

// UploadPhoto godoc
// @Summary     Unggah Foto Profil
// @Description Peserta mengunggah foto profil ke local storage
// @Tags        Peserta - User
// @Security    BearerAuth
// @Accept      multipart/form-data
// @Produce     json
// @Param       photo formData file true "File Foto (JPG/PNG)"
// @Success     200   {object} response.SuccessResponse
// @Failure     400   {object} response.ErrorResponse
// @Router      /users/me/photo [post]
func (h *UserHandler) UploadPhoto(c echo.Context) error {
	payloadValue := c.Get(appMiddleware.AuthorizationPayloadKey)
	if payloadValue == nil {
		return response.Error(c, http.StatusUnauthorized, "Tidak terautentikasi", nil)
	}
	payload, ok := payloadValue.(*utils.TokenPayload)
	if !ok {
		return response.Error(c, http.StatusInternalServerError, "Terjadi kesalahan internal server", nil)
	}

	file, err := c.FormFile("photo")
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "Gagal mengunggah foto", nil)
	}

	if file.Size > 5*1024*1024 {
		return response.Error(c, http.StatusBadRequest, "Ukuran foto maksimal 5MB", nil)
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		return response.Error(c, http.StatusBadRequest, "Format foto harus JPG atau PNG", nil)
	}

	src, err := file.Open()
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memproses file", nil)
	}
	defer src.Close()

	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal membuat direktori upload", nil)
	}

	newFileName := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	dstPath := filepath.Join(uploadDir, newFileName)

	dst, err := os.Create(dstPath)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menyimpan foto", nil)
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal menyimpan konten foto", nil)
	}

	photoURL := "/uploads/" + newFileName
	err = h.service.UpdateUserPhoto(c.Request().Context(), payload.UserID, photoURL)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal memperbarui database", nil)
	}

	return response.Success(c, http.StatusOK, "Foto profil berhasil diperbarui", map[string]string{"photo_url": photoURL})
}
