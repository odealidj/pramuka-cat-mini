package tracer

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.27.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// InitTracer menginisialisasi OpenTelemetry TracerProvider dengan OTLP gRPC exporter ke Jaeger.
// Mengembalikan fungsi shutdown yang harus dipanggil saat aplikasi berhenti.
//
// Parameter:
//   - ctx:         context untuk koneksi gRPC
//   - serviceName: nama service yang tampil di Jaeger UI
//   - endpoint:    alamat OTLP gRPC Jaeger, contoh: "localhost:4317"
func InitTracer(ctx context.Context, serviceName, endpoint string) (shutdown func(context.Context) error, err error) {
	// 1. Buat koneksi gRPC ke Jaeger collector (tanpa TLS untuk local dev)
	conn, err := grpc.NewClient(
		endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat koneksi gRPC ke Jaeger (%s): %w", endpoint, err)
	}

	// 2. Buat OTLP trace exporter via gRPC
	exporter, err := otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, fmt.Errorf("gagal membuat OTLP trace exporter: %w", err)
	}

	// 3. Definisikan resource (metadata service yang tampil di Jaeger UI)
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion("1.0.0"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat OTEL resource: %w", err)
	}

	// 4. Buat TracerProvider dengan BatchSpanProcessor agar efisien
	//    (span dikumpulkan dulu lalu dikirim sekaligus, bukan satu per satu)
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()), // Trace semua request (ubah di prod)
	)

	// 5. Set sebagai global TracerProvider agar bisa diakses dari seluruh aplikasi
	otel.SetTracerProvider(tp)

	// Kembalikan fungsi shutdown dengan timeout
	shutdown = func(ctx context.Context) error {
		shutdownCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		return tp.Shutdown(shutdownCtx)
	}

	return shutdown, nil
}
