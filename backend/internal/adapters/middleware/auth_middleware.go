package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/pkg/response"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
)

const (
	authorizationHeaderKey  = "authorization"
	authorizationTypeBearer = "bearer"
	AuthorizationPayloadKey = "authorization_payload" // Diekspor agar bisa diakses oleh handler jika butuh data UserID

	RoleSuperAdmin = "super_admin"
	RoleAdmin      = "admin"
	RolePeserta    = "peserta"
)

// RequireAuth adalah Gatekeeper utama yang memvalidasi JWT sekaligus memastikannya masih "Stateful" (Ada di Redis)
func RequireAuth(cache ports.AuthCache) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get(authorizationHeaderKey)
			var accessToken string

			if len(authHeader) == 0 {
				// Cek query parameter "token", khusus digunakan untuk EventSource (SSE)
				queryToken := c.QueryParam("token")
				if queryToken != "" {
					accessToken = queryToken
				} else {
					return response.Error(c, http.StatusUnauthorized, "Header otorisasi tidak disertakan", nil)
				}
			} else {
				fields := strings.Fields(authHeader)
				if len(fields) < 2 {
					return response.Error(c, http.StatusUnauthorized, "Format header otorisasi tidak valid", nil)
				}

				authType := strings.ToLower(fields[0])
				if authType != authorizationTypeBearer {
					return response.Error(c, http.StatusUnauthorized, "Tipe otorisasi tidak didukung (harus Bearer)", nil)
				}

				accessToken = fields[1]
			}
			payload, err := utils.ValidateToken(accessToken, false)
			if err != nil {
				return response.Error(c, http.StatusUnauthorized, "Token tidak valid atau kedaluwarsa", nil)
			}

			// Pengecekan krusial: Memastikan sesi ID yang ada di token JWT belum dicabut di memori Redis
			_, err = cache.GetSession(context.Background(), payload.SessionID)
			if err != nil {
				return response.Error(c, http.StatusUnauthorized, "Sesi telah berakhir atau ditolak server", nil)
			}

			// Menitipkan data (UserID, Role, dll) ke dalam Context Request
			c.Set(AuthorizationPayloadKey, payload)
			return next(c)
		}
	}
}

// RequireRole adalah pelindung rute berbasis peran (Role-Based Access Control)
func RequireRole(allowedRoles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Mengambil Payload dari Context (pastikan middleware RequireAuth dijalankan lebih dulu!)
			payloadValue := c.Get(AuthorizationPayloadKey)
			if payloadValue == nil {
				return response.Error(c, http.StatusUnauthorized, "Tidak terautentikasi", nil)
			}

			payload, ok := payloadValue.(*utils.TokenPayload)
			if !ok {
				return response.Error(c, http.StatusInternalServerError, "Terjadi kesalahan internal server membaca sesi", nil)
			}

			roleMatched := false
			for _, role := range allowedRoles {
				if payload.Role == role {
					roleMatched = true
					break
				}
			}

			if !roleMatched {
				return response.Error(c, http.StatusForbidden, "Akses ditolak: Wewenang Anda tidak cukup untuk rute ini", nil)
			}

			return next(c)
		}
	}
}

// RequireSuperAdmin hanya mengizinkan role super_admin
func RequireSuperAdmin() echo.MiddlewareFunc {
	return RequireRole(RoleSuperAdmin)
}

// RequireAdmin hanya mengizinkan role admin (tidak termasuk super_admin)
func RequireAdmin() echo.MiddlewareFunc {
	return RequireRole(RoleAdmin)
}
