package tracer

import (
	"context"
	"log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

var (
	// ActiveParticipantsGauge melacak jumlah peserta yang sedang mengerjakan ujian berdasarkan event_id
	ActiveParticipantsGauge metric.Int64UpDownCounter

	// TotalLoginsCounter melacak total peserta yang login
	TotalLoginsCounter metric.Int64Counter

	// HTTPRequestDuration melacak latensi HTTP dan menyimpan exemplar trace_id
	HTTPRequestDuration metric.Float64Histogram
)

// InitCustomMetrics menginisialisasi instrumen metrik bisnis kustom
func InitCustomMetrics() {
	meter := otel.Meter("pramukacat-business")
	var err error

	ActiveParticipantsGauge, err = meter.Int64UpDownCounter(
		"pramukacat_active_participants",
		metric.WithDescription("Jumlah peserta yang sedang mengerjakan ujian"),
		metric.WithUnit("{participant}"),
	)
	if err != nil {
		log.Printf("Peringatan: Gagal membuat metric ActiveParticipantsGauge: %v", err)
	}

	TotalLoginsCounter, err = meter.Int64Counter(
		"pramukacat_total_logins",
		metric.WithDescription("Total percobaan login peserta ke platform"),
		metric.WithUnit("{login}"),
	)
	if err != nil {
		log.Printf("Peringatan: Gagal membuat metric TotalLoginsCounter: %v", err)
	}

	HTTPRequestDuration, err = meter.Float64Histogram(
		"http_server_duration",
		metric.WithDescription("Durasi request HTTP masuk dalam detik"),
		metric.WithUnit("s"),
	)
	if err != nil {
		log.Printf("Peringatan: Gagal membuat metric HTTPRequestDuration: %v", err)
	}
}

// AddLogin bertambah 1 setiap kali ada percobaan login
func AddLogin(ctx context.Context) {
	if TotalLoginsCounter != nil {
		TotalLoginsCounter.Add(ctx, 1)
	}
}

// IncActiveParticipant bertambah 1 setiap kali peserta mulai ujian
func IncActiveParticipant(ctx context.Context, eventID string) {
	if ActiveParticipantsGauge != nil {
		ActiveParticipantsGauge.Add(ctx, 1, metric.WithAttributes(
			attribute.String("event_id", eventID),
		))
	}
}

// DecActiveParticipant berkurang 1 setiap kali peserta selesai ujian
func DecActiveParticipant(ctx context.Context, eventID string) {
	if ActiveParticipantsGauge != nil {
		ActiveParticipantsGauge.Add(ctx, -1, metric.WithAttributes(
			attribute.String("event_id", eventID),
		))
	}
}

// RecordHTTPReqDuration mencatat durasi request HTTP dengan Exemplar Trace ID
func RecordHTTPReqDuration(ctx context.Context, method, route string, status int, duration float64) {
	if HTTPRequestDuration != nil {
		HTTPRequestDuration.Record(ctx, duration, metric.WithAttributes(
			attribute.String("method", method),
			attribute.String("route", route),
			attribute.Int("status", status),
		))
	}
}
