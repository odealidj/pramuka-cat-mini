package main

import (
	"log"

	"github.com/joho/godotenv"
	"github.com/odealidj/pramuka-CAT/backend/pkg/database"
)

func main() {
	// Muat .env
	godotenv.Load()

	db, err := database.ConnectPostgres()
	if err != nil {
		log.Fatalf("Gagal koneksi db: %v", err)
	}
	defer db.Close()

	log.Println("Menghapus data seeder (Truncate Tables)...")

	// Urutan truncate tidak masalah jika kita menggunakan CASCADE
	// CASCADE akan menghapus data di tabel yang mereferensikan tabel-tabel ini.
	query := `
		TRUNCATE TABLE 
			user_answers,
			user_event_approvals,
			event_questions,
			events,
			questions,
			categories,
			sessions,
			users
		CASCADE;
	`

	_, err = db.Exec(query)
	if err != nil {
		log.Fatalf("Gagal melakukan truncate tabel: %v", err)
	}

	log.Println("Semua data berhasil dibersihkan dari database tanpa menghapus struktur tabel!")
}
