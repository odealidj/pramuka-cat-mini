.PHONY: run stop build test swagger up down infra-up infra-down migrate-up migrate-down seed clear-seed reset-db sqlc docker-build

# Variabel Konfigurasi Database (Sesuaikan dengan .env)
DB_URL="postgres://postgres:postgres@localhost:5432/pramukacat?sslmode=disable"
MIGRATION_PATH="backend/sql/migrations"

# --- Aplikasi Backend ---
run:
	@echo "Menjalankan Backend API..."
	cd backend && go build -o bin/api cmd/api/main.go && ./bin/api

stop:
	@echo "Menghentikan Backend API..."
	@pkill -f "bin/api" || true
	@fuser -k 8080/tcp 2>/dev/null || true
	@echo "Backend API berhasil dihentikan."

build:
	@echo "Membangun Binary Backend..."
	cd backend && go build -o bin/api cmd/api/main.go
	@echo "Build sukses! Binary ada di backend/bin/api"

test:
	@echo "Menjalankan Unit Test..."
	cd backend && go test -v ./internal/...

test-integration:
	@echo "Menyiapkan Database Integration Test (pramukacat_test)..."
	@docker exec -i pramukacat_postgres psql -U POSTGRES_USER -d pramukacat -c "DROP DATABASE IF EXISTS pramukacat_test;" || true
	@docker exec -i pramukacat_postgres psql -U POSTGRES_USER -d pramukacat -c "CREATE DATABASE pramukacat_test;"
	@echo "Menjalankan Migrasi..."
	@docker run --rm -v $$(pwd)/backend/sql/migrations:/migrations --network host migrate/migrate -path=/migrations -database "postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5432/pramukacat_test?sslmode=disable" up
	@echo "Menjalankan Integration Test..."
	cd backend && TEST_DB_URL="postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5432/pramukacat_test?sslmode=disable" go test -v ./tests/integration/...

# --- Performance Testing (K6) ---
test-smoke:
	@echo "Menjalankan Smoke Test (K6) - 1 User, 10 Detik..."
	k6 run -e MODE=smoke backend/loadtest/script.js

test-load:
	@echo "Menjalankan Load Test (K6) - Maks 50 User serentak..."
	k6 run -e MODE=load backend/loadtest/script.js

test-stress:
	@echo "Menjalankan Stress Test (K6) - Maks 500 User serentak..."
	k6 run -e MODE=stress backend/loadtest/script.js

loadtest:
	@echo "Menjalankan Load Test (K6) terhubung ke Grafana (Prometheus)..."
	K6_PROMETHEUS_RW_TREND_STATS="p(90),p(95),p(99),max,min,avg" K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write k6 run --tag testid=pramukacat -o experimental-prometheus-rw -e MODE=load backend/loadtest/script.js

swagger:
	@echo "Generate Swagger Docs..."
	cd backend && swag init -g cmd/api/main.go -o docs --parseDependency --parseInternal
	@echo "Swagger UI tersedia di http://localhost:8080/swagger/index.html setelah server berjalan"

# --- Keseluruhan Sistem (Docker Compose) ---
up:
	@echo "Menyalakan SELURUH sistem (Infra + Backend API) via Docker Compose..."
	docker-compose up -d

down:
	@echo "Mematikan seluruh sistem Docker Compose..."
	docker-compose down

# --- Infrastruktur Khusus ---
infra-up:
	@echo "Menyalakan Infrastruktur (Postgres, Redis, Migrate, Jaeger, Prometheus, Grafana)..."
	docker-compose up -d postgres redis migrate jaeger prometheus grafana
	@echo ""
	@echo "  Jaeger UI → http://localhost:16686"
	@echo "  Grafana   → http://localhost:3030"

infra-down:
	@echo "Mematikan Infrastruktur..."
	docker-compose rm -s -f postgres redis migrate jaeger prometheus grafana

# --- Database Migrations ---
migrate-up:
	@echo "Menjalankan Migrasi Up..."
	migrate -path $(MIGRATION_PATH) -database $(DB_URL) -verbose up

migrate-down:
	@echo "Menjalankan Migrasi Down (Hati-hati: Menghapus Tabel!)..."
	migrate -path $(MIGRATION_PATH) -database $(DB_URL) -verbose down -all

sqlc:
	@echo "Generate kode SQLC..."
	cd backend && sqlc generate

# --- Data Seeding ---
seed:
	@echo "Memasukkan Dummy Data ke Database..."
	cd backend && go run cmd/seeder/main.go

clear-seed:
	@echo "Menghapus Dummy Data dari Database..."
	cd backend && go run cmd/clear_seed/main.go

reset-db: clear-seed seed
	@echo "Database telah dibersihkan dan di-seed ulang dengan sukses!"

# --- Docker Build ---
docker-build:
	@echo "Membangun Docker Image untuk Production..."
	docker build -t pramukacat-backend ./backend
