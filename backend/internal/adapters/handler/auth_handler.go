package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
	appMiddleware "github.com/odealidj/pramuka-CAT/backend/internal/adapters/middleware"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/response"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
)

type AuthHandler struct {
	service ports.AuthService
}

// NewAuthHandler membuat instance Inbound Adapter untuk Autentikasi
func NewAuthHandler(service ports.AuthService) *AuthHandler {
	return &AuthHandler{
		service: service,
	}
}

// RegisterRoutes mendaftarkan rute Autentikasi ke Echo router group
func (h *AuthHandler) RegisterRoutes(g *echo.Group) {
	authGroup := g.Group("/auth")
	authGroup.POST("/login", h.Login)
	authGroup.POST("/refresh", h.Refresh)
	authGroup.POST("/register", h.Register)
}

func (h *AuthHandler) RegisterProtectedRoutes(g *echo.Group) {
	authGroup := g.Group("/auth")
	authGroup.POST("/logout", h.Logout)
}

// Logout godoc
// @Summary     Logout
// @Description Membatalkan sesi aktif dan menginvalidasi token
// @Tags        Auth
// @Security    BearerAuth
// @Produce     json
// @Success     200  {object}  response.SuccessResponse
// @Failure     401  {object}  response.ErrorResponse
// @Router      /protected/auth/logout [post]
func (h *AuthHandler) Logout(c echo.Context) error {
	payloadValue := c.Get(appMiddleware.AuthorizationPayloadKey)
	if payloadValue == nil {
		return response.Error(c, http.StatusUnauthorized, "Tidak terautentikasi", nil)
	}
	payload, ok := payloadValue.(*utils.TokenPayload)
	if !ok {
		return response.Error(c, http.StatusInternalServerError, "Terjadi kesalahan internal server", nil)
	}

	err := h.service.Logout(c.Request().Context(), payload.SessionID)
	if err != nil {
		return response.Error(c, http.StatusInternalServerError, "Gagal logout", []response.ErrorDetail{{Field: "server", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Logout berhasil", nil)
}

// Login godoc
// @Summary     Login
// @Description Autentikasi pengguna dan mendapatkan Access Token & Refresh Token
// @Tags        Auth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.LoginRequest   true  "Kredensial Login"
// @Success     200   {object}  response.SuccessResponse{data=domain.LoginResponse}
// @Failure     401   {object}  response.ErrorResponse
// @Router      /auth/login [post]
func (h *AuthHandler) Login(c echo.Context) error {
	var req domain.LoginRequest

	// Bind payload JSON ke Struct
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	// Teruskan request ke lapisan Service
	resp, err := h.service.Login(c.Request().Context(), req)
	if err != nil {
		return response.Error(c, http.StatusUnauthorized, "Login gagal", []response.ErrorDetail{{Field: "credentials", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Login berhasil", resp)
}

// Refresh godoc
// @Summary     Refresh Token
// @Description Memperbarui Access Token menggunakan Refresh Token yang masih berlaku
// @Tags        Auth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.RefreshRequest   true  "Refresh Token"
// @Success     200   {object}  response.SuccessResponse{data=domain.RefreshResponse}
// @Failure     401   {object}  response.ErrorResponse
// @Router      /auth/refresh [post]
func (h *AuthHandler) Refresh(c echo.Context) error {
	var req domain.RefreshRequest

	// Bind payload JSON ke Struct
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	// Teruskan request ke lapisan Service
	resp, err := h.service.Refresh(c.Request().Context(), req)
	if err != nil {
		return response.Error(c, http.StatusUnauthorized, "Gagal memperbarui token", []response.ErrorDetail{{Field: "token", Message: err.Error()}})
	}

	return response.Success(c, http.StatusOK, "Token berhasil diperbarui", resp)
}

// Register godoc
// @Summary     Register Peserta
// @Description Mendaftarkan akun peserta baru
// @Tags        Auth
// @Accept      json
// @Produce     json
// @Param       body  body      domain.RegisterRequest   true  "Data Registrasi"
// @Success     201   {object}  response.SuccessResponse{data=domain.RegisterResponse}
// @Failure     400   {object}  response.ErrorResponse
// @Router      /auth/register [post]
func (h *AuthHandler) Register(c echo.Context) error {
	var req domain.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "Format request tidak valid", nil)
	}

	resp, err := h.service.Register(c.Request().Context(), req)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "Registrasi gagal", []response.ErrorDetail{{Field: "username", Message: err.Error()}})
	}

	return response.Success(c, http.StatusCreated, "Registrasi berhasil", resp)
}
