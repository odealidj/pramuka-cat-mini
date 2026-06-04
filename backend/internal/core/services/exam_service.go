package services

import (
	"bytes"
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/jung-kurt/gofpdf"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/internal/worker"
	"github.com/odealidj/pramuka-CAT/backend/pkg/tracer"
)

type examService struct {
	repo  ports.ExamRepository
	cache ports.ExamCache
	task  worker.TaskDistributor
}

func NewExamService(repo ports.ExamRepository, cache ports.ExamCache, task worker.TaskDistributor) ports.ExamService {
	return &examService{repo: repo, cache: cache, task: task}
}

func (s *examService) ListUpcomingEvents(ctx context.Context, page int32, limit int32) ([]domain.UpcomingEvent, int64, error) {
	// 1. Coba ambil dari Redis Cache terlebih dahulu
	events, total, err := s.cache.GetCachedUpcomingEvents(ctx, page, limit)
	if err == nil {
		return events, total, nil // Cache Hit
	}

	// 2. Jika Cache Miss, ambil dari Database PostgreSQL
	events, total, err = s.repo.ListUpcomingEvents(ctx, page, limit)
	if err != nil {
		return nil, 0, err
	}

	// 3. Simpan ke Cache secara asynchronous (atau ignore error) untuk request selanjutnya
	_ = s.cache.CacheUpcomingEvents(ctx, page, limit, events, total)

	return events, total, nil
}

func (s *examService) ListMyExams(ctx context.Context, userID uuid.UUID, page int32, limit int32) ([]domain.UserApproval, int64, error) {
	return s.repo.ListUserApprovals(ctx, userID, page, limit)
}

func (s *examService) Enroll(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) error {
	_, err := s.repo.GetApprovalStatus(ctx, userID, eventID)
	if err == nil {
		return fmt.Errorf("anda sudah terdaftar di event ini")
	}
	return s.repo.EnrollToEvent(ctx, userID, eventID)
}

func (s *examService) StartExam(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) ([]domain.ParticipantQuestion, error) {
	approval, err := s.repo.GetApprovalStatus(ctx, userID, eventID)
	if err != nil {
		return nil, fmt.Errorf("anda belum terdaftar di event ini")
	}
	if approval.Status != "approved" {
		return nil, fmt.Errorf("pendaftaran anda belum disetujui oleh admin")
	}
	if approval.IsCompleted {
		return nil, fmt.Errorf("anda sudah menyelesaikan ujian ini")
	}

	now := time.Now()
	if now.Before(approval.StartTime) {
		return nil, fmt.Errorf("ujian belum dimulai")
	}
	if now.After(approval.EndTime) {
		return nil, fmt.Errorf("waktu ujian sudah berakhir")
	}

	// Auto-Resume: Cek apakah ada sesi ujian yang masih tersimpan di Redis
	exists, _ := s.cache.IsExamSessionExists(ctx, approval.ApprovalID)
	if exists {
		// Peserta sudah pernah memulai — kembalikan soal dari cache (auto-resume)
		cachedQuestions, err := s.cache.GetCachedExamSession(ctx, approval.ApprovalID)
		if err == nil && len(cachedQuestions) > 0 {
			return cachedQuestions, nil
		}
	}

	// Set started_at jika peserta baru pertama kali memulai (PRD §3.2.4)
	if approval.StartedAt == nil {
		if err := s.repo.SetStartedAt(ctx, approval.ApprovalID); err != nil {
			return nil, fmt.Errorf("gagal mencatat waktu mulai ujian: %w", err)
		}
		// Track business metric: Tambah 1 peserta aktif untuk event ini
		tracer.IncActiveParticipant(ctx, eventID.String())
	}

	// Tarik soal dari database
	questions, err := s.repo.ListEventQuestionsForParticipant(ctx, eventID)
	if err != nil {
		return nil, err
	}

	// Fisher-Yates Shuffle — PRD §3.2.4: urutan soal diacak untuk setiap peserta
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	for i := len(questions) - 1; i > 0; i-- {
		j := rng.Intn(i + 1)
		questions[i], questions[j] = questions[j], questions[i]
	}

	// Cache soal ke Redis dengan TTL = durasi event
	if err := s.cache.CacheExamSession(ctx, approval.ApprovalID, questions, int(approval.DurationMinutes)); err != nil {
		// Jika Redis gagal, tetap lanjutkan (graceful degradation)
		fmt.Printf("Peringatan: gagal cache sesi ujian ke Redis: %v\n", err)
	}

	return questions, nil
}

func (s *examService) SubmitAnswer(ctx context.Context, userID uuid.UUID, eventID uuid.UUID, req domain.SubmitAnswerRequest) error {
	approval, err := s.repo.GetApprovalStatus(ctx, userID, eventID)
	if err != nil {
		return fmt.Errorf("anda belum terdaftar di event ini")
	}
	if approval.Status != "approved" || approval.IsCompleted {
		return fmt.Errorf("ujian tidak aktif atau sudah selesai")
	}

	now := time.Now()
	if now.After(approval.EndTime) {
		return fmt.Errorf("waktu ujian sudah berakhir")
	}

	// Simpan jawaban ke Redis secara real-time (PRD: tanpa hit database)
	return s.cache.SaveAnswer(ctx, approval.ApprovalID, req.QuestionID, req.SelectedAnswer)
}

func (s *examService) FinishExam(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) (domain.FinishExamResponse, error) {
	approval, err := s.repo.GetApprovalStatus(ctx, userID, eventID)
	if err != nil {
		return domain.FinishExamResponse{}, fmt.Errorf("anda belum terdaftar di event ini")
	}
	if approval.IsCompleted {
		return domain.FinishExamResponse{}, fmt.Errorf("ujian ini sudah diselesaikan")
	}

	// Kirim tugas ke Asynq Background Worker
	payload := &worker.PayloadFinishExam{
		ApprovalID:   approval.ApprovalID,
		UserID:       userID,
		EventID:      eventID,
		PassingGrade: approval.PassingGrade,
	}

	err = s.task.DistributeTaskFinishExam(ctx, payload)
	if err != nil {
		return domain.FinishExamResponse{}, fmt.Errorf("gagal mengantrekan proses penyelesaian ujian: %w", err)
	}

	// Track business metric: Kurangi 1 peserta aktif untuk event ini karena sudah selesai
	tracer.DecActiveParticipant(ctx, eventID.String())

	return domain.FinishExamResponse{
		Message:  "Jawaban sedang diproses di latar belakang. Silakan tunggu beberapa saat.",
		Score:    0,     // Akan dihitung oleh worker
		IsPassed: false, // Akan dievaluasi oleh worker
	}, nil
}

func (s *examService) ReviewParticipantAnswers(ctx context.Context, approvalID uuid.UUID) ([]domain.UserAnswerDetail, error) {
	return s.repo.GetUserAnswersDetail(ctx, approvalID)
}

func (s *examService) ReviewParticipantAnswersByEvent(ctx context.Context, userID uuid.UUID, eventID uuid.UUID) ([]domain.UserAnswerDetail, error) {
	approval, err := s.repo.GetApprovalStatus(ctx, userID, eventID)
	if err != nil {
		return nil, fmt.Errorf("peserta belum terdaftar pada ujian ini")
	}
	if !approval.IsCompleted {
		return nil, fmt.Errorf("ujian belum diselesaikan")
	}
	return s.repo.GetUserAnswersDetail(ctx, approval.ApprovalID)
}

func (s *examService) ExportReviewAnswersPDF(ctx context.Context, approvalID uuid.UUID, participantName, eventName string, score float64, passingGrade float64, isPassed bool) ([]byte, error) {
	answers, err := s.repo.GetUserAnswersDetail(ctx, approvalID)
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil data jawaban: %w", err)
	}

	return generateReviewAnswersPDF(answers, participantName, eventName, score, passingGrade, isPassed)
}

func (s *examService) ExportReviewAnswersByEventPDF(ctx context.Context, userID uuid.UUID, eventID uuid.UUID, participantName, eventName string, score float64, passingGrade float64, isPassed bool) ([]byte, error) {
	approval, err := s.repo.GetApprovalStatus(ctx, userID, eventID)
	if err != nil {
		return nil, fmt.Errorf("peserta belum terdaftar pada ujian ini")
	}
	if !approval.IsCompleted {
		return nil, fmt.Errorf("ujian belum diselesaikan")
	}

	event, err := s.repo.GetEventById(ctx, eventID)
	if err == nil {
		eventName = event.Name
		passingGrade = event.PassingGrade
	}

	answers, err := s.repo.GetUserAnswersDetail(ctx, approval.ApprovalID)
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil data jawaban: %w", err)
	}

	return generateReviewAnswersPDF(answers, participantName, eventName, approval.Score, passingGrade, approval.IsPassed)
}

func generateReviewAnswersPDF(answers []domain.UserAnswerDetail, participantName, eventName string, score float64, passingGrade float64, isPassed bool) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")

	// Set Footer untuk menampilkan nomor halaman
	pdf.SetFooterFunc(func() {
		pdf.SetY(-15)
		pdf.SetFont("Arial", "I", 9)
		pdf.SetTextColor(128, 128, 128)
		pdf.CellFormat(0, 10, fmt.Sprintf("Halaman %d", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	pdf.SetMargins(10, 15, 10)
	pdf.AddPage()

	// Title
	pdf.SetFont("Arial", "B", 16)
	pdf.SetTextColor(92, 52, 16) // #5C3410
	pdf.CellFormat(0, 10, "PramukaCAT - Review Jawaban", "", 1, "C", false, 0, "")

	// SubTitle
	pdf.SetFont("Arial", "I", 11)
	pdf.SetTextColor(122, 69, 32) // #7A4520
	pdf.CellFormat(0, 7, fmt.Sprintf("Event: %s | Peserta: %s", eventName, participantName), "", 1, "C", false, 0, "")

	statusStr := "Tidak Lulus"
	if isPassed {
		statusStr = "Lulus"
	}
	pdf.CellFormat(0, 7, fmt.Sprintf("Skor: %.1f | Passing Grade: %.0f | Status: %s | Dicetak: %s", score, passingGrade, statusStr, time.Now().In(time.Local).Format("02 January 2006 15:04")), "", 1, "C", false, 0, "")
	pdf.Ln(8)

	pdf.SetAutoPageBreak(true, 15)

	// List Soal
	for i, a := range answers {
		pdf.SetTextColor(0, 0, 0)
		pdf.SetFont("Arial", "B", 11)

		// Header Soal (No, Bobot)
		headerText := fmt.Sprintf("Soal No. %d  (Bobot: %d)", i+1, a.Weight)
		pdf.CellFormat(0, 8, headerText, "", 1, "L", false, 0, "")

		// Teks Soal
		pdf.SetFont("Arial", "", 10)
		pdf.MultiCell(0, 6, a.QuestionText, "", "L", false)
		pdf.Ln(2)

		// Opsi Jawaban
		opts := []struct {
			Key  string
			Text string
		}{
			{"A", a.OptionA},
			{"B", a.OptionB},
			{"C", a.OptionC},
			{"D", a.OptionD},
		}

		for _, opt := range opts {
			pdf.SetFont("Arial", "", 10)
			pdf.SetTextColor(100, 100, 100) // Default warna abu-abu untuk opsi yang tidak dipilih

			marker := ""
			if opt.Key == a.CorrectAnswer && opt.Key == a.SelectedAnswer {
				marker = "  [JAWABAN ANDA BENAR]"
				pdf.SetTextColor(16, 185, 129) // Emerald / Hijau
				pdf.SetFont("Arial", "B", 10)
			} else if opt.Key == a.CorrectAnswer {
				marker = "  [KUNCI JAWABAN]"
				pdf.SetTextColor(16, 185, 129) // Emerald / Hijau
				pdf.SetFont("Arial", "B", 10)
			} else if opt.Key == a.SelectedAnswer {
				marker = "  [JAWABAN ANDA - SALAH]"
				pdf.SetTextColor(239, 68, 68) // Merah
				pdf.SetFont("Arial", "B", 10)
			}

			text := fmt.Sprintf("%s. %s%s", opt.Key, opt.Text, marker)
			pdf.MultiCell(0, 6, text, "", "L", false)
		}

		// Garis pembatas antar soal
		pdf.Ln(4)
		pdf.SetDrawColor(220, 220, 220)
		pdf.Line(10, pdf.GetY(), 200, pdf.GetY())
		pdf.Ln(4)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("gagal membuat PDF: %w", err)
	}

	return buf.Bytes(), nil
}
