# --- Tahap 1: Builder ---
FROM golang:alpine AS builder

# Set working directory di dalam container
WORKDIR /app

# Salin module definitions (go.mod, go.sum) untuk mengunduh dependency
COPY go.mod go.sum ./
RUN go mod download

# Salin seluruh kode aplikasi (di dalam folder backend)
COPY . .

# Build binary Go secara statically linked (CGO_ENABLED=0 penting untuk Alpine)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o api ./cmd/api

# --- Tahap 2: Final (Production Image yang sangat ringan) ---
FROM alpine:latest

# Instalasi certificates untuk kebutuhan HTTPS/SSL requests dari Go
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Salin binary dari tahap builder
COPY --from=builder /app/api .
# (Opsional) Salin file .env jika ingin menggunakan metode env file (meski best practice di Docker adalah melalui compose environment vars)
# COPY --from=builder /app/.env . 

# Buka port standar (misalnya Echo berjalan di 8080)
EXPOSE 8080

# Jalankan binary
CMD ["./api"]
