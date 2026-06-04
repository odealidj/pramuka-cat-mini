package services

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	gofpdf "github.com/jung-kurt/gofpdf"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/odealidj/pramuka-CAT/backend/internal/worker"
	"github.com/xuri/excelize/v2"
)

type eventService struct {
	repo            ports.EventRepository
	taskDistributor worker.TaskDistributor
}

func NewEventService(repo ports.EventRepository, taskDistributor worker.TaskDistributor) ports.EventService {
	return &eventService{repo: repo, taskDistributor: taskDistributor}
}

func (s *eventService) CreateEvent(ctx context.Context, req domain.CreateEventRequest) (domain.Event, error) {
	if req.EndTime.Before(req.StartTime) {
		return domain.Event{}, fmt.Errorf("waktu selesai (end_time) tidak boleh sebelum waktu mulai (start_time)")
	}

	// Validasi Duplikat: Nama dan Waktu yang sama
	isDuplicate, err := s.repo.CheckDuplicateEvent(ctx, req.Name, req.StartTime, req.EndTime, nil)
	if err != nil {
		return domain.Event{}, fmt.Errorf("gagal mengecek duplikasi jadwal ujian")
	}
	if isDuplicate {
		return domain.Event{}, fmt.Errorf("jadwal ujian dengan nama dan rentang waktu yang sama sudah terdaftar")
	}

	e := domain.Event{
		Name:            req.Name,
		StartTime:       req.StartTime,
		EndTime:         req.EndTime,
		DurationMinutes: req.DurationMinutes,
		PassingGrade:    req.PassingGrade,
	}
	return s.repo.CreateEvent(ctx, e)
}

func (s *eventService) GetEventById(ctx context.Context, id uuid.UUID) (domain.Event, error) {
	return s.repo.GetEventById(ctx, id)
}

func (s *eventService) ListEvents(ctx context.Context, page int32, limit int32, search string) ([]domain.Event, int64, error) {
	return s.repo.ListEvents(ctx, page, limit, search)
}

func (s *eventService) UpdateEvent(ctx context.Context, id uuid.UUID, req domain.UpdateEventRequest) (domain.Event, error) {
	if req.EndTime.Before(req.StartTime) {
		return domain.Event{}, fmt.Errorf("waktu selesai (end_time) tidak boleh sebelum waktu mulai (start_time)")
	}

	_, err := s.repo.GetEventById(ctx, id)
	if err != nil {
		return domain.Event{}, fmt.Errorf("event tidak ditemukan")
	}

	// Validasi Duplikat saat Update
	isDuplicate, err := s.repo.CheckDuplicateEvent(ctx, req.Name, req.StartTime, req.EndTime, &id)
	if err != nil {
		return domain.Event{}, fmt.Errorf("gagal mengecek duplikasi jadwal ujian")
	}
	if isDuplicate {
		return domain.Event{}, fmt.Errorf("jadwal ujian dengan nama dan rentang waktu yang sama sudah terdaftar")
	}

	e := domain.Event{
		Name:            req.Name,
		StartTime:       req.StartTime,
		EndTime:         req.EndTime,
		DurationMinutes: req.DurationMinutes,
		PassingGrade:    req.PassingGrade,
	}
	return s.repo.UpdateEvent(ctx, id, e)
}

func (s *eventService) DeleteEvent(ctx context.Context, id uuid.UUID) error {
	event, err := s.repo.GetEventById(ctx, id)
	if err != nil {
		return fmt.Errorf("event tidak ditemukan")
	}

	participants, err := s.repo.ListAllEventParticipants(ctx, id)
	if err == nil && s.taskDistributor != nil {
		for _, p := range participants {
			if p.Email.Valid && p.Email.String != "" {
				s.taskDistributor.DistributeTaskSendEmail(context.Background(), &worker.PayloadSendEmail{
					ToAddress: p.Email.String,
					Subject:   "Pemberitahuan: Jadwal Ujian Dibatalkan",
					Body:      fmt.Sprintf("Halo %s,\n\nMohon maaf, Jadwal Ujian '%s' yang Anda ikuti telah dibatalkan atau dihapus oleh Admin.\n\nTerima kasih.\n\nTim Pramuka CAT", p.FullName, event.Name),
				})
			}
		}
	}

	// Delete approvals
	s.repo.DeleteApprovalsByEventID(ctx, id)

	return s.repo.DeleteEvent(ctx, id)
}

func (s *eventService) AddEventQuestion(ctx context.Context, eventID uuid.UUID, req domain.AddEventQuestionRequest) error {
	_, err := s.repo.GetEventById(ctx, eventID)
	if err != nil {
		return fmt.Errorf("event tidak ditemukan")
	}
	// Di sistem nyata, kita mungkin perlu memvalidasi apakah questionID benar-benar ada di tabel questions
	return s.repo.AddEventQuestion(ctx, eventID, req.QuestionID)
}

func (s *eventService) ListEventQuestions(ctx context.Context, eventID uuid.UUID, page int32, limit int32) ([]domain.Question, int64, error) {
	return s.repo.ListEventQuestions(ctx, eventID, page, limit)
}

func (s *eventService) RemoveEventQuestion(ctx context.Context, eventID uuid.UUID, questionID uuid.UUID) error {
	return s.repo.RemoveEventQuestion(ctx, eventID, questionID)
}

func (s *eventService) ListEventParticipants(ctx context.Context, eventID uuid.UUID, page int32, limit int32, search string) ([]domain.EventParticipant, int64, error) {
	return s.repo.ListEventParticipants(ctx, eventID, page, limit, search)
}

func (s *eventService) ApproveUserEvent(ctx context.Context, approvalID uuid.UUID) error {
	err := s.repo.ApproveUserEvent(ctx, approvalID)
	if err == nil && s.taskDistributor != nil {
		approval, _ := s.repo.GetApprovalById(ctx, approvalID)
		if approval.UserID != uuid.Nil {
			user, _ := s.repo.GetUserById(ctx, approval.UserID)
			event, _ := s.repo.GetEventById(ctx, approval.EventID)

			title := "Pendaftaran Disetujui"
			msg := fmt.Sprintf("Pendaftaran Anda untuk ujian %s telah disetujui. Anda dapat memulai ujian pada waktu yang ditentukan.", event.Name)
			
			s.taskDistributor.DistributeTaskCreateNotification(context.Background(), &worker.PayloadCreateNotification{
				UserID:  user.ID,
				Title:   title,
				Message: msg,
				Type:    "event_approval",
			})
			if user.Email != nil && *user.Email != "" {
				s.taskDistributor.DistributeTaskSendEmail(context.Background(), &worker.PayloadSendEmail{
					ToAddress: *user.Email,
					Subject:   "Pendaftaran Ujian Disetujui",
					Body:      fmt.Sprintf("Halo %s,\n\n%s\n\nSalam,\nAdmin Pramuka CAT", user.FullName, msg),
				})
			}
		}
	}
	return err
}

func (s *eventService) RevokeUserEvent(ctx context.Context, approvalID uuid.UUID) error {
	err := s.repo.RevokeUserEvent(ctx, approvalID)
	if err == nil && s.taskDistributor != nil {
		approval, _ := s.repo.GetApprovalById(ctx, approvalID)
		if approval.UserID != uuid.Nil {
			user, _ := s.repo.GetUserById(ctx, approval.UserID)
			event, _ := s.repo.GetEventById(ctx, approval.EventID)

			title := "Pendaftaran Dibatalkan"
			msg := fmt.Sprintf("Pendaftaran Anda untuk ujian %s telah dibatalkan (revoked) oleh admin.", event.Name)
			
			s.taskDistributor.DistributeTaskCreateNotification(context.Background(), &worker.PayloadCreateNotification{
				UserID:  user.ID,
				Title:   title,
				Message: msg,
				Type:    "event_revocation",
			})
			if user.Email != nil && *user.Email != "" {
				s.taskDistributor.DistributeTaskSendEmail(context.Background(), &worker.PayloadSendEmail{
					ToAddress: *user.Email,
					Subject:   "Pendaftaran Ujian Dibatalkan",
					Body:      fmt.Sprintf("Halo %s,\n\n%s\n\nSalam,\nAdmin Pramuka CAT", user.FullName, msg),
				})
			}
		}
	}
	return err
}

func (s *eventService) RemoveUserEvent(ctx context.Context, approvalID uuid.UUID) error {
	// Dapatkan data sebelum dihapus
	approval, errGet := s.repo.GetApprovalById(ctx, approvalID)
	
	err := s.repo.RemoveUserEvent(ctx, approvalID)
	if err == nil && errGet == nil && s.taskDistributor != nil {
		if approval.UserID != uuid.Nil {
			user, _ := s.repo.GetUserById(ctx, approval.UserID)
			event, _ := s.repo.GetEventById(ctx, approval.EventID)

			title := "Dikeluarkan dari Ujian"
			msg := fmt.Sprintf("Anda telah dikeluarkan secara permanen dari ujian %s oleh admin.", event.Name)
			
			s.taskDistributor.DistributeTaskCreateNotification(context.Background(), &worker.PayloadCreateNotification{
				UserID:  user.ID,
				Title:   title,
				Message: msg,
				Type:    "event_removal",
			})
			if user.Email != nil && *user.Email != "" {
				s.taskDistributor.DistributeTaskSendEmail(context.Background(), &worker.PayloadSendEmail{
					ToAddress: *user.Email,
					Subject:   "Dikeluarkan dari Ujian",
					Body:      fmt.Sprintf("Halo %s,\n\n%s\n\nSalam,\nAdmin Pramuka CAT", user.FullName, msg),
				})
			}
		}
	}
	return err
}

func (s *eventService) AddRandomEventQuestions(ctx context.Context, eventID uuid.UUID, req domain.AddRandomEventQuestionsRequest) error {
	if req.Amount > 500 {
		return fmt.Errorf("jumlah soal maksimal untuk penarikan acak dalam satu waktu adalah 500 soal")
	}

	_, err := s.repo.GetEventById(ctx, eventID)
	if err != nil {
		return fmt.Errorf("event tidak ditemukan")
	}

	// Cek ketersediaan soal
	available, err := s.repo.CountAvailableQuestions(ctx, eventID, req.CategoryID)
	if err != nil {
		return fmt.Errorf("gagal mengecek ketersediaan soal: %w", err)
	}

	if int64(req.Amount) > available {
		return fmt.Errorf("soal yang tersedia tidak mencukupi (diminta: %d, tersedia: %d)", req.Amount, available)
	}

	return s.repo.AddRandomEventQuestions(ctx, eventID, req.CategoryID, req.Amount)
}

func (s *eventService) getParticipantsForExport(ctx context.Context, eventID uuid.UUID) (domain.Event, []domain.EventParticipantExport, error) {
	event, err := s.repo.GetEventById(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, fmt.Errorf("event tidak ditemukan")
	}
	participants, err := s.repo.GetAllEventParticipantsForExport(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, fmt.Errorf("gagal mengambil data peserta: %w", err)
	}
	return event, participants, nil
}

// ExportEventParticipantsExcel menghasilkan file .xlsx dengan styling PramukaCAT
func (s *eventService) ExportEventParticipantsExcel(ctx context.Context, eventID uuid.UUID) ([]byte, error) {
	event, participants, err := s.getParticipantsForExport(ctx, eventID)
	if err != nil {
		return nil, err
	}

	f := excelize.NewFile()
	defer f.Close()

	sheet := "Laporan Peserta"
	f.SetSheetName("Sheet1", sheet)

	// ── Baris 1: Judul ──────────────────────────────────────────────────────────
	f.MergeCell(sheet, "A1", "G1")
	f.SetCellValue(sheet, "A1", fmt.Sprintf("PramukaCAT - Laporan Peserta Ujian %s", event.Name))
	styleTitle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 14, Color: "5C3410"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheet, "A1", "G1", styleTitle)
	f.SetRowHeight(sheet, 1, 22)

	// ── Baris 2: Subtitle / tanggal ─────────────────────────────────────────────
	f.MergeCell(sheet, "A2", "G2")
	f.SetCellValue(sheet, "A2", fmt.Sprintf("Passing Grade: %.0f  |  Dicetak pada: %s", event.PassingGrade, time.Now().In(time.Local).Format("02 January 2006 15:04")))
	styleSubtitle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Italic: true, Color: "7A4520"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheet, "A2", "G2", styleSubtitle)
	f.SetRowHeight(sheet, 2, 16)

	// ── Baris 3: Header kolom ────────────────────────────────────────────────────
	headers := []string{"No", "Username", "Nama Lengkap", "Status", "Sudah Submit", "Waktu Mulai", "Waktu Selesai"}
	for col, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(col+1, 3)
		f.SetCellValue(sheet, cell, h)
	}
	styleHeader, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF", Size: 10},
		Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"9C5A22"}},
		Border: []excelize.Border{
			{Type: "left", Color: "7A4520", Style: 1},
			{Type: "right", Color: "7A4520", Style: 1},
			{Type: "top", Color: "7A4520", Style: 1},
			{Type: "bottom", Color: "7A4520", Style: 1},
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})
	f.SetCellStyle(sheet, "A3", "G3", styleHeader)
	f.SetRowHeight(sheet, 3, 18)

	// ── Data rows mulai baris 4 ──────────────────────────────────────────────────
	for i, p := range participants {
		row := i + 4
		isCompleted := "Tidak"
		if p.IsCompleted {
			isCompleted = "Ya"
		}
		startedAt := "-"
		if p.StartedAt != nil {
			startedAt = p.StartedAt.In(time.Local).Format("02/01/2006 15:04")
		}
		completedAt := "-"
		if p.CompletedAt != nil {
			completedAt = p.CompletedAt.In(time.Local).Format("02/01/2006 15:04")
		}

		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), p.Username)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), p.FullName)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), p.Status)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), isCompleted)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), startedAt)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), completedAt)
	}

	// ── Lebar kolom ─────────────────────────────────────────────────────────────
	f.SetColWidth(sheet, "A", "A", 5)
	f.SetColWidth(sheet, "B", "B", 18)
	f.SetColWidth(sheet, "C", "C", 26)
	f.SetColWidth(sheet, "D", "D", 13)
	f.SetColWidth(sheet, "E", "E", 14)
	f.SetColWidth(sheet, "F", "F", 20)
	f.SetColWidth(sheet, "G", "G", 20)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("gagal menulis file Excel: %w", err)
	}
	return buf.Bytes(), nil
}

// ExportEventParticipantsPDF menghasilkan file .pdf dengan tabel data peserta
func (s *eventService) ExportEventParticipantsPDF(ctx context.Context, eventID uuid.UUID) ([]byte, error) {
	event, participants, err := s.getParticipantsForExport(ctx, eventID)
	if err != nil {
		return nil, err
	}

	pdf := gofpdf.New("L", "mm", "A4", "")

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
	pdf.CellFormat(0, 10, fmt.Sprintf("PramukaCAT - Laporan Peserta Ujian %s", event.Name), "", 1, "C", false, 0, "")

	// SubTitle
	pdf.SetFont("Arial", "I", 11)
	pdf.SetTextColor(122, 69, 32) // #7A4520
	pdf.CellFormat(0, 7, fmt.Sprintf("Passing Grade: %.0f  |  Dicetak pada: %s", event.PassingGrade, time.Now().In(time.Local).Format("02 January 2006 15:04")), "", 1, "C", false, 0, "")
	pdf.Ln(5)

	// Header tabel
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(156, 90, 34) // Dark Brown
	pdf.SetTextColor(255, 255, 255)
	colW := []float64{8, 40, 60, 25, 25, 40, 40}
	headers := []string{"No", "Username", "Nama Lengkap", "Status", "Submit", "Waktu Mulai", "Waktu Selesai"}
	for i, h := range headers {
		pdf.CellFormat(colW[i], 8, h, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	// Data
	pdf.SetFont("Arial", "", 8)
	pdf.SetTextColor(0, 0, 0)
	for i, p := range participants {
		// Warna zebra
		if i%2 == 0 {
			pdf.SetFillColor(255, 255, 255) // White
		} else {
			pdf.SetFillColor(249, 244, 240) // Light Brown
		}

		isCompleted := "Tidak"
		if p.IsCompleted {
			isCompleted = "Ya"
		}
		startedAt := "-"
		if p.StartedAt != nil {
			startedAt = p.StartedAt.In(time.Local).Format("02/01 15:04")
		}
		completedAt := "-"
		if p.CompletedAt != nil {
			completedAt = p.CompletedAt.In(time.Local).Format("02/01 15:04")
		}

		vals := []string{
			strconv.Itoa(i + 1),
			p.Username,
			p.FullName,
			p.Status,
			isCompleted,
			startedAt,
			completedAt,
		}
		for j, v := range vals {
			align := "L"
			if j == 0 {
				align = "C"
			}
			pdf.CellFormat(colW[j], 7, v, "1", 0, align, true, 0, "")
		}
		pdf.Ln(-1)
	}

	// Footer
	pdf.Ln(5)
	pdf.SetFont("Arial", "I", 8)
	pdf.SetTextColor(128, 128, 128)
	pdf.CellFormat(0, 5, fmt.Sprintf("Total Peserta: %d | Dokumen ini digenerate secara otomatis oleh sistem Pramuka CAT", len(participants)), "", 0, "C", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("gagal menulis file PDF: %w", err)
	}
	return buf.Bytes(), nil
}

// ExportEventQuestionsExcel menghasilkan file .xlsx daftar soal event dengan styling
func (s *eventService) ExportEventQuestionsExcel(ctx context.Context, eventID uuid.UUID, showKey bool) ([]byte, error) {
	event, err := s.GetEventById(ctx, eventID)
	if err != nil {
		return nil, err
	}
	questions, _, err := s.repo.ListEventQuestions(ctx, eventID, 1, 1000000)
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil data soal: %w", err)
	}

	f := excelize.NewFile()
	defer f.Close()
	sheet := "Daftar Soal"
	f.SetSheetName("Sheet1", sheet)

	titleCols := "F1"
	if showKey {
		titleCols = "G1"
	}

	f.MergeCell(sheet, "A1", titleCols)
	f.SetCellValue(sheet, "A1", fmt.Sprintf("PramukaCAT - Soal Ujian %s", event.Name))
	styleTitle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 14, Color: "5C3410"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheet, "A1", titleCols, styleTitle)
	f.SetRowHeight(sheet, 1, 22)

	titleColsDate := "F2"
	if showKey {
		titleColsDate = "G2"
	}

	f.MergeCell(sheet, "A2", titleColsDate)
	f.SetCellValue(sheet, "A2", fmt.Sprintf("Dicetak pada: %s", time.Now().In(time.Local).Format("02 January 2006 15:04")))
	dateStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Italic: true, Color: "7A4520"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetCellStyle(sheet, "A2", titleColsDate, dateStyle)
	f.SetRowHeight(sheet, 2, 16)

	headers := []string{"No", "Teks Soal", "Opsi A", "Opsi B", "Opsi C", "Opsi D"}
	if showKey {
		headers = append(headers, "Kunci Jawaban")
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"9C5A22"}, Pattern: 1},
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	dataStyle, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
	})

	for i, header := range headers {
		col := string(rune('A'+i)) + "3"
		f.SetCellValue(sheet, col, header)
	}
	
	headerEndCol := string(rune('A'+len(headers)-1)) + "3"
	f.SetCellStyle(sheet, "A3", headerEndCol, headerStyle)

	f.SetColWidth(sheet, "A", "A", 8)
	f.SetColWidth(sheet, "B", "B", 40)
	f.SetColWidth(sheet, "C", "F", 25)
	if showKey {
		f.SetColWidth(sheet, "G", "G", 15)
	}

	for i, q := range questions {
		row := i + 4
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), q.QuestionText)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), q.OptionA)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), q.OptionB)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), q.OptionC)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), q.OptionD)
		if showKey {
			f.SetCellValue(sheet, fmt.Sprintf("G%d", row), q.CorrectAnswer)
		}
		dataEndCol := string(rune('A'+len(headers)-1)) + fmt.Sprintf("%d", row)
		f.SetCellStyle(sheet, fmt.Sprintf("A%d", row), dataEndCol, dataStyle)
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("gagal menulis file Excel: %w", err)
	}
	return buf.Bytes(), nil
}

// ExportEventQuestionsPDF menghasilkan file .pdf daftar soal event
func (s *eventService) ExportEventQuestionsPDF(ctx context.Context, eventID uuid.UUID, showKey bool) ([]byte, error) {
	event, err := s.GetEventById(ctx, eventID)
	if err != nil {
		return nil, err
	}
	questions, _, err := s.repo.ListEventQuestions(ctx, eventID, 1, 1000000)
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil data soal: %w", err)
	}

	pdf := gofpdf.New("L", "mm", "A4", "")

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
	pdf.CellFormat(277, 10, fmt.Sprintf("PramukaCAT - Soal Ujian %s", event.Name), "", 1, "C", false, 0, "")

	// SubTitle
	pdf.SetFont("Arial", "I", 11)
	pdf.SetTextColor(122, 69, 32) // #7A4520
	pdf.CellFormat(277, 7, fmt.Sprintf("Dicetak pada: %s", time.Now().In(time.Local).Format("02 January 2006 15:04")), "", 1, "C", false, 0, "")
	pdf.Ln(8)

	pdf.SetFont("Arial", "B", 10)
	pdf.SetFillColor(156, 90, 34) // Dark Brown
	pdf.SetTextColor(255, 255, 255)

	headers := []string{"No", "Teks Soal", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci Jawaban"}
	colW := []float64{10, 105, 35, 35, 35, 35, 22}
	if !showKey {
		headers = []string{"No", "Teks Soal", "Opsi A", "Opsi B", "Opsi C", "Opsi D"}
		colW = []float64{10, 115, 38, 38, 38, 38}
	}

	for i, h := range headers {
		pdf.CellFormat(colW[i], 10, h, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 9)

	for i, q := range questions {
		if i%2 == 0 {
			pdf.SetFillColor(255, 255, 255)
		} else {
			pdf.SetFillColor(249, 244, 240)
		}

		lines1 := pdf.SplitText(q.QuestionText, colW[1])
		lines2 := pdf.SplitText(q.OptionA, colW[2])
		lines3 := pdf.SplitText(q.OptionB, colW[3])
		lines4 := pdf.SplitText(q.OptionC, colW[4])
		lines5 := pdf.SplitText(q.OptionD, colW[5])
        
		maxLines := len(lines1)
		if len(lines2) > maxLines { maxLines = len(lines2) }
		if len(lines3) > maxLines { maxLines = len(lines3) }
		if len(lines4) > maxLines { maxLines = len(lines4) }
		if len(lines5) > maxLines { maxLines = len(lines5) }

		h := float64(maxLines) * 5
		if h < 10 {
			h = 10
		}
		
		if pdf.GetY()+h > 190 {
			pdf.AddPage()
		}
		
		x, y := pdf.GetXY()
		
		pdf.Rect(x, y, colW[0], h, "DF")
		pdf.SetXY(x, y+(h-5)/2)
		pdf.CellFormat(colW[0], 5, fmt.Sprintf("%d", i+1), "", 0, "C", false, 0, "")
		
		pdf.SetXY(x+colW[0], y)
		pdf.Rect(x+colW[0], y, colW[1], h, "DF")
		pdf.MultiCell(colW[1], 5, q.QuestionText, "", "L", false)
		
		pdf.SetXY(x+colW[0]+colW[1], y)
		pdf.Rect(x+colW[0]+colW[1], y, colW[2], h, "DF")
		pdf.MultiCell(colW[2], 5, q.OptionA, "", "L", false)

		pdf.SetXY(x+colW[0]+colW[1]+colW[2], y)
		pdf.Rect(x+colW[0]+colW[1]+colW[2], y, colW[3], h, "DF")
		pdf.MultiCell(colW[3], 5, q.OptionB, "", "L", false)

		pdf.SetXY(x+colW[0]+colW[1]+colW[2]+colW[3], y)
		pdf.Rect(x+colW[0]+colW[1]+colW[2]+colW[3], y, colW[4], h, "DF")
		pdf.MultiCell(colW[4], 5, q.OptionC, "", "L", false)

		pdf.SetXY(x+colW[0]+colW[1]+colW[2]+colW[3]+colW[4], y)
		pdf.Rect(x+colW[0]+colW[1]+colW[2]+colW[3]+colW[4], y, colW[5], h, "DF")
		pdf.MultiCell(colW[5], 5, q.OptionD, "", "L", false)

		if showKey {
			pdf.SetXY(x+colW[0]+colW[1]+colW[2]+colW[3]+colW[4]+colW[5], y)
			pdf.Rect(x+colW[0]+colW[1]+colW[2]+colW[3]+colW[4]+colW[5], y, colW[6], h, "DF")
			pdf.SetXY(x+colW[0]+colW[1]+colW[2]+colW[3]+colW[4]+colW[5], y+(h-5)/2)
			pdf.CellFormat(colW[6], 5, q.CorrectAnswer, "", 0, "C", false, 0, "")
		}
		
		pdf.SetXY(x, y+h)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("gagal menulis file PDF: %w", err)
	}
	return buf.Bytes(), nil
}
