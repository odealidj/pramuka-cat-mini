package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
	"github.com/stretchr/testify/assert"
)

func TestE2E_ExamFlow(t *testing.T) {
	clearDatabase()

	// 1. Persiapan Data (Seed Admin & Peserta)
	ctx := context.Background()
	
	adminPassword, _ := utils.HashPassword("admin123")
	_, err := queries.CreateUser(ctx, sqlcgen.CreateUserParams{
		Username:     "admin_test",
		PasswordHash: adminPassword,
		FullName:     "Super Admin Test",
		Role:         "admin",
	})
	assert.NoError(t, err)

	pesertaPassword, _ := utils.HashPassword("peserta123")
	_, err = queries.CreateUser(ctx, sqlcgen.CreateUserParams{
		Username:     "peserta_test",
		PasswordHash: pesertaPassword,
		FullName:     "Peserta Test",
		Role:         "peserta",
	})
	assert.NoError(t, err)

	var adminToken string
	var pesertaToken string
	var categoryID int32
	var eventID uuid.UUID
	var questionID uuid.UUID

	// 2. Test Login (Mendapatkan Token)
	t.Run("Login Admin", func(t *testing.T) {
		reqBody := map[string]string{"username": "admin_test", "password": "admin123"}
		bodyBytes, _ := json.Marshal(reqBody)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		testEchoApp.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var resp map[string]interface{}
		json.Unmarshal(rec.Body.Bytes(), &resp)

		data := resp["data"].(map[string]interface{})
		adminToken = data["access_token"].(string)
		assert.NotEmpty(t, adminToken)
	})

	t.Run("Login Peserta", func(t *testing.T) {
		reqBody := map[string]string{"username": "peserta_test", "password": "peserta123"}
		bodyBytes, _ := json.Marshal(reqBody)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		testEchoApp.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var resp map[string]interface{}
		json.Unmarshal(rec.Body.Bytes(), &resp)

		data := resp["data"].(map[string]interface{})
		pesertaToken = data["access_token"].(string)
		assert.NotEmpty(t, pesertaToken)
	})

	// 3. Test Buat Jadwal Ujian (Admin)
	t.Run("Admin Buat Kategori dan Jadwal Ujian", func(t *testing.T) {
		// A. Buat Kategori
		catReq := map[string]interface{}{
			"name": "Ujian Golang Integration",
		}
		catBytes, _ := json.Marshal(catReq)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/protected/admin/categories", bytes.NewReader(catBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rec := httptest.NewRecorder()

		testEchoApp.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusCreated, rec.Code)
		var catResp map[string]interface{}
		json.Unmarshal(rec.Body.Bytes(), &catResp)
		catData := catResp["data"].(map[string]interface{})
		categoryID = int32(catData["id"].(float64))

		// B. Buat Event (Jadwal)
		startTime := time.Now().Add(-10 * time.Minute) // Sudah mulai
		endTime := time.Now().Add(60 * time.Minute)    // Selesai 1 jam lagi
		schedReq := map[string]interface{}{
			"name":             "Sesi Pagi Golang",
			"start_time":       startTime.Format(time.RFC3339),
			"end_time":         endTime.Format(time.RFC3339),
			"duration_minutes": 60,
			"passing_grade":    70,
		}
		schedBytes, _ := json.Marshal(schedReq)
		req2 := httptest.NewRequest(http.MethodPost, "/api/v1/protected/admin/events", bytes.NewReader(schedBytes))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", "Bearer "+adminToken)
		rec2 := httptest.NewRecorder()

		testEchoApp.ServeHTTP(rec2, req2)
		assert.Equal(t, http.StatusCreated, rec2.Code)
		var schedResp map[string]interface{}
		json.Unmarshal(rec2.Body.Bytes(), &schedResp)
		schedData := schedResp["data"].(map[string]interface{})
		eventID = uuid.MustParse(schedData["id"].(string))
	})

	// 4. Test Tambah Soal (Admin)
	t.Run("Admin Tambah Soal", func(t *testing.T) {
		questionReq := map[string]interface{}{
			"category_id":    categoryID,
			"question_text":  "Apa fungsi dari goroutine?",
			"option_a":       "Database",
			"option_b":       "Concurrency ringan",
			"option_c":       "Cache",
			"option_d":       "OS Thread",
			"correct_answer": "B",
			"weight":         1,
		}
		qBytes, _ := json.Marshal(questionReq)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/protected/admin/questions", bytes.NewReader(qBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+adminToken)
		rec := httptest.NewRecorder()

		testEchoApp.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusCreated, rec.Code)
		
		var qResp map[string]interface{}
		json.Unmarshal(rec.Body.Bytes(), &qResp)
		qData := qResp["data"].(map[string]interface{})
		questionID = uuid.MustParse(qData["id"].(string))

		// Masukkan soal ke Event
		addQReq := map[string]interface{}{
			"question_id": questionID.String(),
		}
		addQBytes, _ := json.Marshal(addQReq)
		reqQ := httptest.NewRequest(http.MethodPost, "/api/v1/protected/admin/events/"+eventID.String()+"/questions", bytes.NewReader(addQBytes))
		reqQ.Header.Set("Content-Type", "application/json")
		reqQ.Header.Set("Authorization", "Bearer "+adminToken)
		recQ := httptest.NewRecorder()
		testEchoApp.ServeHTTP(recQ, reqQ)
		assert.Equal(t, http.StatusCreated, recQ.Code)
	})

	// 4.5. Peserta Enroll ke Event
	var approvalID uuid.UUID
	t.Run("Peserta Mendaftar Event", func(t *testing.T) {
		enrollReq := map[string]interface{}{
			"event_id": eventID.String(),
		}
		eBytes, _ := json.Marshal(enrollReq)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/protected/exams/enroll", bytes.NewReader(eBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+pesertaToken)
		rec := httptest.NewRecorder()

		testEchoApp.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code)

		// Admin perlu setuju
		// Cek DB untuk mendapatkan approval_id
		approvals, err := queries.ListEventParticipants(ctx, sqlcgen.ListEventParticipantsParams{
			EventID: uuid.NullUUID{UUID: eventID, Valid: true},
			Limit:   10,
			Offset:  0,
		})
		assert.NoError(t, err)
		assert.NotEmpty(t, approvals)
		approvalID = approvals[0].ApprovalID

		// Admin Approve
		reqApp := httptest.NewRequest(http.MethodPut, "/api/v1/protected/admin/events/"+eventID.String()+"/participants/"+approvalID.String()+"/approve", nil)
		reqApp.Header.Set("Authorization", "Bearer "+adminToken)
		recApp := httptest.NewRecorder()
		testEchoApp.ServeHTTP(recApp, reqApp)
		assert.Equal(t, http.StatusOK, recApp.Code, "Approve Error: "+recApp.Body.String())
	})

	// 5. Test Ambil Ujian (Peserta)
	t.Run("Peserta Memulai Ujian", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/protected/exams/"+eventID.String()+"/start", nil)
		req.Header.Set("Authorization", "Bearer "+pesertaToken)
		rec := httptest.NewRecorder()

		testEchoApp.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code, "Start Error: "+rec.Body.String())
	})

	// 6. Test Mengerjakan Soal (Peserta)
	t.Run("Peserta Menjawab Soal", func(t *testing.T) {
		ansReq := map[string]interface{}{
			"question_id":     questionID.String(),
			"selected_answer": "B", // Jawaban benar
		}
		ansBytes, _ := json.Marshal(ansReq)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/protected/exams/"+eventID.String()+"/submit-answer", bytes.NewReader(ansBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+pesertaToken)
		rec := httptest.NewRecorder()

		testEchoApp.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code, "Answer Error: "+rec.Body.String())

		var resp map[string]interface{}
		json.Unmarshal(rec.Body.Bytes(), &resp)
		// Check that answer was saved successfully
		assert.Equal(t, float64(200), resp["code"])
	})
}
