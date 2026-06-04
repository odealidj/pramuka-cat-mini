package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/XSAM/otelsql"
)

// ConnectPostgres membuka koneksi ke PostgreSQL menggunakan Environment Variables
func ConnectPostgres() (*sql.DB, error) {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	sslmode := os.Getenv("DB_SSLMODE")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)

	db, err := otelsql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("gagal membuka konfigurasi database: %w", err)
	}

	// Performance Tuning: Database Connection Pooling
	db.SetMaxOpenConns(100) // Batasi koneksi maksimum agar DB tidak kehabisan resource saat diserang (Max Postgres default 100)
	db.SetMaxIdleConns(20)  // Jumlah koneksi menganggur yang disimpan di pool agar tidak perlu buka/tutup koneksi
	db.SetConnMaxLifetime(15 * time.Minute) // Daur ulang koneksi agar tidak hang

	// Tes Ping ke database
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("gagal melakukan ping ke database: %w", err)
	}

	log.Println("Sukses terhubung ke database PostgreSQL")
	return db, nil
}
