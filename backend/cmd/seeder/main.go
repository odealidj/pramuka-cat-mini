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
	// Muat .env
	godotenv.Load()

	db, err := database.ConnectPostgres()
	if err != nil {
		log.Fatalf("Gagal koneksi db: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	queries := sqlcgen.New(db)

	log.Println("=== Menjalankan Seeder Manual (CLI) ===")
	log.Println("Memulai Seeding Database (Data Pramuka Realistis)...")

	// 1. Seed Users
	// Super Admin
	superAdminPassword, _ := utils.HashPassword("superadmin123")
	superAdmin, err := queries.CreateUser(ctx, sqlcgen.CreateUserParams{
		Username:     "superadmin",
		PasswordHash: superAdminPassword,
		FullName:     "Kak Budi Santoso (Super Admin)",
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
		FullName:     "Kak Siti Aminah (Admin Kwartir)",
		Role:         "admin",
		PhotoUrl:     sql.NullString{String: "", Valid: false},
	})
	if err != nil {
		log.Printf("Info: Admin 'admin_pramuka' gagal dibuat (mungkin sudah ada): %v", err)
	} else {
		log.Printf("Berhasil insert Admin: %s (password: admin123)", admin.Username)
	}

	// Peserta
	pesertaNames := []string{"Andi Supriyadi", "Dedi Kurniawan", "Rina Marlina", "Eko Prasetyo", "Dewi Lestari"}
	pesertaPassword, _ := utils.HashPassword("peserta123")
	var pesertaIDs []uuid.UUID
	for i, name := range pesertaNames {
		peserta, err := queries.CreateUser(ctx, sqlcgen.CreateUserParams{
			Username:     fmt.Sprintf("peserta%d", i+1),
			PasswordHash: pesertaPassword,
			FullName:     name,
			Role:         "peserta",
			PhotoUrl:     sql.NullString{String: "", Valid: false},
		})
		if err == nil {
			pesertaIDs = append(pesertaIDs, peserta.ID)
		} else {
			log.Printf("Info: Peserta %s gagal dibuat: %v", name, err)
		}
	}
	log.Printf("Berhasil insert %d Peserta baru (password: peserta123)", len(pesertaIDs))

	// 2. Seed Categories
	categories := []string{"Pengetahuan Umum Kepramukaan (PUK)", "Sandi dan Morse", "Sejarah Kepramukaan"}
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
	if len(categoryIDs) == 3 {
		questionsData := []sqlcgen.CreateQuestionParams{
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[0], Valid: true},
				QuestionText:  "Siapakah Bapak Pramuka Indonesia?",
				OptionA:       "Ir. Soekarno",
				OptionB:       "Sri Sultan Hamengkubuwono IX",
				OptionC:       "Jenderal Sudirman",
				OptionD:       "Ki Hajar Dewantara",
				CorrectAnswer: "B",
				Weight:        10,
			},
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[0], Valid: true},
				QuestionText:  "Lambang gerakan pramuka adalah tunas kelapa. Siapakah pencipta lambang tersebut?",
				OptionA:       "H. Mutahar",
				OptionB:       "Soenardjo Atmodipoerwo",
				OptionC:       "Sri Sultan Hamengkubuwono IX",
				OptionD:       "W.R. Supratman",
				CorrectAnswer: "B",
				Weight:        10,
			},
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[0], Valid: true},
				QuestionText:  "Berapakah usia anggota Pramuka golongan Penggalang?",
				OptionA:       "7 - 10 tahun",
				OptionB:       "11 - 15 tahun",
				OptionC:       "16 - 20 tahun",
				OptionD:       "21 - 25 tahun",
				CorrectAnswer: "B",
				Weight:        10,
			},
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[0], Valid: true},
				QuestionText:  "Apa kode kehormatan bagi Pramuka Penggalang?",
				OptionA:       "Dwisatya dan Dwidarma",
				OptionB:       "Trisatya dan Dasadarma",
				OptionC:       "Trisatya dan Pancasila",
				OptionD:       "Pancasila dan UUD 1945",
				CorrectAnswer: "B",
				Weight:        10,
			},
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[1], Valid: true},
				QuestionText:  "Dalam sandi morse, huruf 'A' dilambangkan dengan...",
				OptionA:       "- .",
				OptionB:       ". -",
				OptionC:       ". .",
				OptionD:       "- -",
				CorrectAnswer: "B",
				Weight:        10,
			},
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[1], Valid: true},
				QuestionText:  "Alat apakah yang paling sering digunakan untuk mengirimkan isyarat morse pada siang hari jarak jauh?",
				OptionA:       "Peluit",
				OptionB:       "Api Unggun",
				OptionC:       "Senter",
				OptionD:       "Bendera Semaphore",
				CorrectAnswer: "A",
				Weight:        10,
			},
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[1], Valid: true},
				QuestionText:  "Sandi kotak 1 memiliki bentuk dasar garis lurus vertikal, horizontal, dan...",
				OptionA:       "Lingkaran",
				OptionB:       "Segitiga",
				OptionC:       "Menyilang (X)",
				OptionD:       "Melengkung",
				CorrectAnswer: "C",
				Weight:        10,
			},
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[2], Valid: true},
				QuestionText:  "Tanggal berapakah Hari Pramuka Nasional dirayakan setiap tahunnya?",
				OptionA:       "14 Agustus",
				OptionB:       "28 Oktober",
				OptionC:       "20 Mei",
				OptionD:       "1 Juni",
				CorrectAnswer: "A",
				Weight:        10,
			},
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[2], Valid: true},
				QuestionText:  "Siapakah Bapak Pandu Dunia (Chief Scout of the World)?",
				OptionA:       "Robert Stephenson Smyth Baden-Powell",
				OptionB:       "William Alexander Smith",
				OptionC:       "Ernest Thompson Seton",
				OptionD:       "Daniel Carter Beard",
				CorrectAnswer: "A",
				Weight:        10,
			},
			{
				CategoryID:    sql.NullInt32{Int32: categoryIDs[2], Valid: true},
				QuestionText:  "Buku panduan kepramukaan karya Baden Powell yang sangat terkenal berjudul...",
				OptionA:       "The Jungle Book",
				OptionB:       "Scouting for Boys",
				OptionC:       "Rovering to Success",
				OptionD:       "Aids to Scouting",
				CorrectAnswer: "B",
				Weight:        10,
			},
		}

		for _, qData := range questionsData {
			q, err := queries.CreateQuestion(ctx, qData)
			if err == nil {
				questionIDs = append(questionIDs, q.ID)
			} else {
				log.Printf("Gagal insert soal: %v", err)
			}
		}
		log.Printf("Berhasil insert %d Soal baru ke Bank Soal", len(questionIDs))
	}

	// 4. Seed Event
	event, err := queries.CreateEvent(ctx, sqlcgen.CreateEventParams{
		Name:            "Tryout Pramuka Garuda 2026 - Kwartir Nasional",
		StartTime:       time.Now().Add(-1 * time.Hour), // Berjalan
		EndTime:         time.Now().Add(24 * time.Hour),
		DurationMinutes: 120,
		PassingGrade:    "75.00",
	})

	if err != nil {
		log.Printf("Info: Gagal insert event (mungkin duplikat): %v", err)
	} else {
		log.Printf("Berhasil insert Event: %s", event.Name)

		// 5. Relasi Soal ke Event
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

		// 6. Enroll Peserta
		var approvalIDs []uuid.UUID
		countEnroll := 0
		for i, pID := range pesertaIDs {
			if i >= 3 {
				break // 3 peserta pertama di-approve
			}
			approval, err := queries.EnrollUserToEvent(ctx, sqlcgen.EnrollUserToEventParams{
				UserID:  uuid.NullUUID{UUID: pID, Valid: true},
				EventID: uuid.NullUUID{UUID: event.ID, Valid: true},
			})
			if err == nil {
				approved, err := queries.ApproveUserEvent(ctx, approval.ID)
				if err == nil {
					approvalIDs = append(approvalIDs, approved.ID)
					countEnroll++
				}
			}
		}
		log.Printf("Berhasil menyetujui %d peserta untuk Tryout", countEnroll)

		// 7. Dummy Answers
		countAnswers := 0
		for _, approvalID := range approvalIDs {
			for i, qID := range questionIDs {
				if i >= 3 {
					break // Cuma jawab 3 soal pertama
				}
				selected := "B"
				if i == 0 { selected = "B" } // Benar
				if i == 1 { selected = "B" } // Benar
				if i == 2 { selected = "B" } // Benar

				_, err := queries.SaveUserAnswer(ctx, sqlcgen.SaveUserAnswerParams{
					ApprovalID:     uuid.NullUUID{UUID: approvalID, Valid: true},
					QuestionID:     uuid.NullUUID{UUID: qID, Valid: true},
					SelectedAnswer: sql.NullString{String: selected, Valid: true},
					IsCorrect:      sql.NullBool{Bool: true, Valid: true}, // Simulasi benar
				})
				if err == nil {
					countAnswers++
				}
			}
		}
		log.Printf("Berhasil menyimpan %d jawaban dummy dari peserta", countAnswers)
	}

	// 8. Session Admin
	if admin.ID != uuid.Nil {
		sessionID := uuid.New()
		_, err = queries.CreateSession(ctx, sqlcgen.CreateSessionParams{
			ID:           sessionID,
			UserID:       admin.ID,
			RefreshToken: "dummy_refresh_token_for_seed",
			IsBlocked:    false,
			ExpiresAt:    time.Now().Add(24 * time.Hour),
		})
		if err == nil {
			log.Printf("Berhasil insert Dummy Session untuk admin")
		}
	}

	log.Println("Seeding Database Selesai dengan Sukses!")
}
