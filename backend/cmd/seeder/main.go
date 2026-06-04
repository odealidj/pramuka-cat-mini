package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/odealidj/pramuka-CAT/backend/internal/adapters/repository/sqlcgen"
	"github.com/odealidj/pramuka-CAT/backend/pkg/database"
	"github.com/odealidj/pramuka-CAT/backend/pkg/utils"
)

func main() {
	// Muat .env (Diasumsikan dijalankan dari folder backend/)
	godotenv.Load()

	db, err := database.ConnectPostgres()
	if err != nil {
		log.Fatalf("Gagal koneksi db: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	queries := sqlcgen.New(db)

	log.Println("Memulai Seeding Database (Mock Data)...")

	// 1. Seed Users
	// Super Admin
	superAdminPassword, _ := utils.HashPassword("superadmin123")
	superAdmin, err := queries.CreateUser(ctx, sqlcgen.CreateUserParams{
		Username:     "superadmin",
		PasswordHash: superAdminPassword,
		FullName:     "Super Administrator",
		Role:         "super_admin",
		PhotoUrl:     sql.NullString{String: "", Valid: false},
	})
	if err != nil {
		log.Printf("Info: Super Admin 'superadmin' gagal dibuat (mungkin sudah ada): %v", err)
	} else {
		log.Printf("Berhasil insert Super Admin: %s (password: superadmin123)", superAdmin.Username)
	}

	// Admin
	adminPassword, _ := utils.HashPassword("admin123")
	admin, err := queries.CreateUser(ctx, sqlcgen.CreateUserParams{
		Username:     "admin_pramuka",
		PasswordHash: adminPassword,
		FullName:     "Administrator Pusat",
		Role:         "admin",
		PhotoUrl:     sql.NullString{String: "", Valid: false},
	})
	if err != nil {
		log.Printf("Info: Admin 'admin_pramuka' gagal dibuat (mungkin sudah ada): %v", err)
	} else {
		log.Printf("Berhasil insert Admin: %s (password: admin123)", admin.Username)
	}

	// Peserta
	pesertaPassword, _ := utils.HashPassword("peserta123")
	var pesertaIDs []uuid.UUID
	for i := 1; i <= 5; i++ {
		peserta, err := queries.CreateUser(ctx, sqlcgen.CreateUserParams{
			Username:     fmt.Sprintf("peserta%d", i),
			PasswordHash: pesertaPassword,
			FullName:     fmt.Sprintf("Peserta Simulasi Tryout %d", i),
			Role:         "peserta",
			PhotoUrl:     sql.NullString{String: "", Valid: false},
		})
		if err == nil {
			pesertaIDs = append(pesertaIDs, peserta.ID)
		} else {
			log.Printf("Info: Peserta %d gagal dibuat: %v", i, err)
		}
	}
	log.Printf("Berhasil insert %d Peserta baru (password: peserta123)", len(pesertaIDs))

	// 2. Seed Categories
	categories := []string{"Pengetahuan Kepramukaan", "Sandi Morse", "Sejarah Pramuka"}
	var categoryIDs []int32
	for _, c := range categories {
		cat, err := queries.CreateCategory(ctx, c)
		if err == nil {
			categoryIDs = append(categoryIDs, cat.ID)
		}
	}
	log.Printf("Berhasil insert %d Kategori baru", len(categoryIDs))

	// 3. Seed Questions
	var questionIDs []uuid.UUID
	if len(categoryIDs) > 0 {
		for i := 1; i <= 10; i++ {
			catID := categoryIDs[i%len(categoryIDs)]
			q, err := queries.CreateQuestion(ctx, sqlcgen.CreateQuestionParams{
				CategoryID:    sql.NullInt32{Int32: catID, Valid: true},
				QuestionText:  fmt.Sprintf("Ini adalah contoh pertanyaan menantang nomor %d terkait Pramuka?", i),
				OptionA:       "Pilihan yang Sangat Benar",
				OptionB:       "Pilihan Pengecoh B",
				OptionC:       "Pilihan Pengecoh C",
				OptionD:       "Pilihan Pengecoh D",
				CorrectAnswer: "A",
				Weight:        10,
			})
			if err == nil {
				questionIDs = append(questionIDs, q.ID)
			}
		}
		log.Printf("Berhasil insert %d Soal baru ke Bank Soal", len(questionIDs))
	}

	// 4. Seed Event
	event, err := queries.CreateEvent(ctx, sqlcgen.CreateEventParams{
		Name:            "Simulasi Tryout CAT Pramuka 2026",
		StartTime:       time.Now().Add(-1 * time.Hour), // Set waktu mulai 1 jam yang lalu agar statusnya 'Sedang Berjalan'
		EndTime:         time.Now().Add(24 * time.Hour), // Selesai besok
		DurationMinutes: 120,
		PassingGrade:    "70.00",
	})

	if err != nil {
		log.Printf("Info: Gagal insert event (mungkin duplikat atau issue lain): %v", err)
	} else {
		log.Printf("Berhasil insert Event: %s", event.Name)

		// 5. Relasi Soal ke Event (event_questions)
		countRel := 0
		for _, qID := range questionIDs {
			err := queries.CreateEventQuestion(ctx, sqlcgen.CreateEventQuestionParams{
				EventID:    event.ID,
				QuestionID: qID,
			})
			if err == nil {
				countRel++
			}
		}
		log.Printf("Berhasil mengaitkan %d soal secara spesifik ke dalam Event Tryout", countRel)

		// 6. Enroll Peserta (Simulasi pendaftaran dan persetujuan ujian)
		var approvalIDs []uuid.UUID
		countEnroll := 0
		for i, pID := range pesertaIDs {
			if i >= 2 {
				break // Hanya 2 peserta pertama yang kita simulasikan sudah di-approve
			}
			approval, err := queries.EnrollUserToEvent(ctx, sqlcgen.EnrollUserToEventParams{
				UserID:  uuid.NullUUID{UUID: pID, Valid: true},
				EventID: uuid.NullUUID{UUID: event.ID, Valid: true},
			})
			if err == nil {
				// Langsung di approve oleh Admin agar siap ujuan
				approved, err := queries.ApproveUserEvent(ctx, approval.ID)
				if err == nil {
					approvalIDs = append(approvalIDs, approved.ID)
					countEnroll++
				}
			}
		}
		log.Printf("Berhasil menyetujui (approve) %d peserta untuk mengikuti ujian Tryout", countEnroll)

		// 7. Insert Dummy User Answers (Simulasi pengerjaan soal oleh peserta)
		countAnswers := 0
		for _, approvalID := range approvalIDs {
			for i, qID := range questionIDs {
				// Cuma jawab 5 soal pertama saja
				if i >= 5 {
					break
				}
				// Asumsikan A adalah jawaban benar
				_, err := queries.SaveUserAnswer(ctx, sqlcgen.SaveUserAnswerParams{
					ApprovalID:     uuid.NullUUID{UUID: approvalID, Valid: true},
					QuestionID:     uuid.NullUUID{UUID: qID, Valid: true},
					SelectedAnswer: sql.NullString{String: "A", Valid: true},
					IsCorrect:      sql.NullBool{Bool: true, Valid: true},
				})
				if err == nil {
					countAnswers++
				}
			}
		}
		log.Printf("Berhasil menyimpan %d jawaban dummy untuk peserta ujian", countAnswers)
	}

	// 8. Insert Dummy Session untuk Admin
	sessionID := uuid.New()
	_, err = queries.CreateSession(ctx, sqlcgen.CreateSessionParams{
		ID:           sessionID,
		UserID:       admin.ID,
		RefreshToken: "dummy_refresh_token_for_seed",
		IsBlocked:    false,
		ExpiresAt:    time.Now().Add(24 * time.Hour),
	})
	if err != nil {
		log.Printf("Info: Gagal insert session: %v", err)
	} else {
		log.Printf("Berhasil insert Dummy Session untuk admin")
	}

	log.Println("Seeding Database Selesai dengan Sukses! Anda bisa mulai login di API.")
}
