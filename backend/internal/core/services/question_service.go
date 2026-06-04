package services

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/domain"
	"github.com/odealidj/pramuka-CAT/backend/internal/core/ports"
	"github.com/xuri/excelize/v2"
)

const defaultCategoryName = "Umum"

type questionService struct {
	repo         ports.QuestionRepository
	categoryRepo ports.CategoryRepository
}

func NewQuestionService(repo ports.QuestionRepository, categoryRepo ports.CategoryRepository) ports.QuestionService {
	return &questionService{repo: repo, categoryRepo: categoryRepo}
}

// getOrCreateDefaultCategory mencari kategori "Umum", jika tidak ada maka dibuat otomatis.
func (s *questionService) getOrCreateDefaultCategory(ctx context.Context) (int32, error) {
	cat, err := s.categoryRepo.GetCategoryByName(ctx, defaultCategoryName)
	if err == nil {
		return cat.ID, nil
	}
	// Tidak ditemukan — buat baru
	newCat, err := s.categoryRepo.CreateCategory(ctx, defaultCategoryName)
	if err != nil {
		return 0, fmt.Errorf("gagal membuat kategori default '%s': %w", defaultCategoryName, err)
	}
	return newCat.ID, nil
}

func (s *questionService) CreateQuestion(ctx context.Context, req domain.CreateQuestionRequest) (domain.Question, error) {
	// Validasi dasar, di luar validator lib
	if req.QuestionText == "" {
		return domain.Question{}, fmt.Errorf("teks pertanyaan tidak boleh kosong")
	}

	// Cek duplikasi teks pertanyaan
	isDuplicate, err := s.repo.CheckDuplicateQuestion(ctx, req.QuestionText, nil)
	if err != nil {
		return domain.Question{}, fmt.Errorf("gagal memvalidasi keunikan soal: %w", err)
	}
	if isDuplicate {
		return domain.Question{}, fmt.Errorf("soal dengan pertanyaan serupa sudah terdaftar")
	}

	// Jika kategori tidak dipilih, gunakan kategori "Umum" (buat jika belum ada)
	categoryID := req.CategoryID
	if categoryID == nil {
		id, err := s.getOrCreateDefaultCategory(ctx)
		if err != nil {
			return domain.Question{}, err
		}
		categoryID = &id
	}

	q := domain.Question{
		CategoryID:    categoryID,
		QuestionText:  req.QuestionText,
		OptionA:       req.OptionA,
		OptionB:       req.OptionB,
		OptionC:       req.OptionC,
		OptionD:       req.OptionD,
		CorrectAnswer: req.CorrectAnswer,
		Weight:        req.Weight,
	}
	return s.repo.CreateQuestion(ctx, q)
}

func (s *questionService) GetQuestionById(ctx context.Context, id uuid.UUID) (domain.Question, error) {
	return s.repo.GetQuestionById(ctx, id)
}

func (s *questionService) ListQuestions(ctx context.Context, page int32, limit int32, search string, categoryId *int32) ([]domain.Question, int64, error) {
	return s.repo.ListQuestions(ctx, page, limit, search, categoryId)
}

func (s *questionService) UpdateQuestion(ctx context.Context, id uuid.UUID, req domain.UpdateQuestionRequest) (domain.Question, error) {
	// Pastikan pertanyaan ada
	_, err := s.repo.GetQuestionById(ctx, id)
	if err != nil {
		return domain.Question{}, fmt.Errorf("pertanyaan tidak ditemukan")
	}

	// Cek duplikasi teks pertanyaan (kecuali soal ini sendiri)
	isDuplicate, err := s.repo.CheckDuplicateQuestion(ctx, req.QuestionText, &id)
	if err != nil {
		return domain.Question{}, fmt.Errorf("gagal memvalidasi keunikan soal: %w", err)
	}
	if isDuplicate {
		return domain.Question{}, fmt.Errorf("soal dengan pertanyaan serupa sudah terdaftar")
	}

	q := domain.Question{
		CategoryID:    req.CategoryID,
		QuestionText:  req.QuestionText,
		OptionA:       req.OptionA,
		OptionB:       req.OptionB,
		OptionC:       req.OptionC,
		OptionD:       req.OptionD,
		CorrectAnswer: req.CorrectAnswer,
		Weight:        req.Weight,
	}
	return s.repo.UpdateQuestion(ctx, id, q)
}

func (s *questionService) DeleteQuestion(ctx context.Context, id uuid.UUID) error {
	_, err := s.repo.GetQuestionById(ctx, id)
	if err != nil {
		return fmt.Errorf("pertanyaan tidak ditemukan")
	}
	return s.repo.DeleteQuestion(ctx, id)
}

func (s *questionService) PreviewImportExcel(ctx context.Context, fileData []byte) (*domain.ImportQuestionsPreviewResponse, error) {
	f, err := excelize.OpenReader(bytes.NewReader(fileData))
	if err != nil {
		return nil, fmt.Errorf("gagal membaca file Excel: %w", err)
	}
	defer f.Close()

	sheetList := f.GetSheetList()
	if len(sheetList) == 0 {
		return nil, fmt.Errorf("file Excel kosong")
	}
	if sheetList[0] != "Soal" {
		return nil, fmt.Errorf("Anda melakukan perubahan template, sheet pertama harus bernama 'Soal'")
	}
	if len(sheetList) < 2 || sheetList[1] != "Kategori Soal" {
		return nil, fmt.Errorf("Anda melakukan perubahan template, sheet kedua harus bernama 'Kategori Soal'")
	}

	rows, err := f.GetRows(sheetList[0])
	if err != nil {
		return nil, fmt.Errorf("gagal membaca sheet Soal: %w", err)
	}

	if len(rows) < 2 {
		return nil, fmt.Errorf("file Excel kosong atau tidak memiliki data")
	}

	if len(rows) > 501 {
		return nil, fmt.Errorf("file Excel terlalu besar. Maksimal 500 data soal per file")
	}

	// Fetch all categories for validation
	categories, _, err := s.categoryRepo.ListCategories(ctx, 1, 1000000, "")
	if err != nil {
		return nil, fmt.Errorf("gagal memuat referensi kategori: %w", err)
	}
	validCategories := make(map[int32]bool)
	for _, c := range categories {
		validCategories[c.ID] = true
	}

	var response domain.ImportQuestionsPreviewResponse
	var data []domain.ImportQuestionRow
	validCount := 0
	errorCount := 0

	// Menyimpan teks soal yang ada di dalam file ini untuk mendeteksi duplikat internal
	seenQuestions := make(map[string]int)

	for i, row := range rows {
		if i == 0 {
			// Validate headers
			expectedHeaders := []string{"Kategori ID", "Teks Soal", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci Jawaban", "Bobot Nilai"}
			for j, header := range expectedHeaders {
				if j >= len(row) || strings.TrimSpace(row[j]) != header {
					return nil, fmt.Errorf("Anda melakukan perubahan template, format header tidak valid. Kolom %s harus '%s'", string(rune('A'+j)), header)
				}
			}
			continue // Skip header
		}

		// Ensure row has enough columns (up to H, which is 8 columns)
		for len(row) < 8 {
			row = append(row, "")
		}

		rowNum := i + 1
		importRow := domain.ImportQuestionRow{
			Row:           rowNum,
			IsValid:       true,
		}

		// Kolom A: Kategori ID
		if row[0] == "" {
			importRow.IsValid = false
			importRow.Error = "Kategori ID tidak boleh kosong"
		} else {
			catID, err := strconv.Atoi(row[0])
			if err != nil {
				importRow.IsValid = false
				importRow.Error = "Kategori ID harus berupa angka"
			} else {
				id32 := int32(catID)
				if !validCategories[id32] {
					importRow.IsValid = false
					importRow.Error = fmt.Sprintf("Kategori ID %d tidak ditemukan di database", id32)
				} else {
					importRow.CategoryID = &id32
				}
			}
		}

		// Kolom B: Teks Soal
		qText := strings.TrimSpace(row[1])
		importRow.QuestionText = qText
		if qText == "" {
			importRow.IsValid = false
			importRow.Error = "Teks Soal tidak boleh kosong"
		}

		// Kolom C, D, E, F: Opsi A - D
		importRow.OptionA = strings.TrimSpace(row[2])
		importRow.OptionB = strings.TrimSpace(row[3])
		importRow.OptionC = strings.TrimSpace(row[4])
		importRow.OptionD = strings.TrimSpace(row[5])
		if importRow.OptionA == "" || importRow.OptionB == "" || importRow.OptionC == "" || importRow.OptionD == "" {
			importRow.IsValid = false
			if importRow.Error == "" {
				importRow.Error = "Opsi A, B, C, dan D tidak boleh kosong"
			}
		}

		// Kolom G: Kunci Jawaban
		ans := strings.ToUpper(strings.TrimSpace(row[6]))
		importRow.CorrectAnswer = ans
		if ans != "A" && ans != "B" && ans != "C" && ans != "D" {
			importRow.IsValid = false
			if importRow.Error == "" {
				importRow.Error = "Kunci Jawaban harus A, B, C, atau D"
			}
		}

		// Kolom H: Bobot
		if row[7] == "" {
			importRow.Weight = 10 // Default bobot 10
		} else {
			w, err := strconv.Atoi(strings.TrimSpace(row[7]))
			if err != nil || w < 1 {
				importRow.IsValid = false
				if importRow.Error == "" {
					importRow.Error = "Bobot Nilai harus berupa angka positif minimal 1"
				}
			} else {
				importRow.Weight = int32(w)
			}
		}

		// Cek Duplikat Internal (dalam file)
		if qText != "" {
			normalizedQText := strings.ToLower(strings.ReplaceAll(qText, " ", ""))
			if prevRow, exists := seenQuestions[normalizedQText]; exists {
				importRow.IsValid = false
				if importRow.Error == "" {
					importRow.Error = fmt.Sprintf("Soal ini duplikat dengan baris ke-%d", prevRow)
				}
			} else {
				seenQuestions[normalizedQText] = rowNum
			}

			// Cek Duplikat di Database (hanya jika valid sejauh ini)
			if importRow.IsValid {
				isDupDB, err := s.repo.CheckDuplicateQuestion(ctx, qText, nil)
				if err == nil && isDupDB {
					importRow.IsValid = false
					importRow.Error = "Soal dengan pertanyaan serupa sudah ada di database"
				}
			}
		}

		if importRow.IsValid {
			validCount++
		} else {
			errorCount++
		}
		data = append(data, importRow)
	}

	response.TotalRows = len(data)
	response.ValidRows = validCount
	response.ErrorRows = errorCount
	response.Data = data

	return &response, nil
}

func (s *questionService) ConfirmImportExcel(ctx context.Context, req domain.ConfirmImportRequest) (int, error) {
	if len(req.Questions) == 0 {
		return 0, fmt.Errorf("tidak ada soal yang di-import")
	}

	var questionsToInsert []domain.Question
	for _, row := range req.Questions {
		if !row.IsValid {
			return 0, fmt.Errorf("terdapat soal yang tidak valid pada baris ke-%d. Simpan dibatalkan", row.Row)
		}

		questionsToInsert = append(questionsToInsert, domain.Question{
			CategoryID:    row.CategoryID,
			QuestionText:  row.QuestionText,
			OptionA:       row.OptionA,
			OptionB:       row.OptionB,
			OptionC:       row.OptionC,
			OptionD:       row.OptionD,
			CorrectAnswer: row.CorrectAnswer,
			Weight:        row.Weight,
		})
	}

	err := s.repo.CreateQuestionsBatch(ctx, questionsToInsert)
	if err != nil {
		return 0, fmt.Errorf("gagal menyimpan batch soal: %w", err)
	}

	return len(questionsToInsert), nil
}

func (s *questionService) DownloadTemplateExcel(ctx context.Context) ([]byte, error) {
	f := excelize.NewFile()

	// Buat Style untuk Header (Background Cokelat Tema, Text Putih Bold, Border)
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"9C5A22"}, Pattern: 1},
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("gagal membuat style header: %w", err)
	}

	// Buat Style untuk Data (Hanya Border)
	dataStyle, err := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("gagal membuat style data: %w", err)
	}

	// ===============================
	// Sheet 1: Soal
	// ===============================
	sheetSoal := "Soal"
	f.SetSheetName("Sheet1", sheetSoal)
	headersSoal := []string{"Kategori ID", "Teks Soal", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci Jawaban", "Bobot Nilai"}
	
	// Set Header Soal
	for i, header := range headersSoal {
		col := string(rune('A'+i)) + "1"
		f.SetCellValue(sheetSoal, col, header)
	}
	f.SetCellStyle(sheetSoal, "A1", "H1", headerStyle)

	// Set Lebar Kolom agar lebih rapi
	f.SetColWidth(sheetSoal, "A", "A", 15)
	f.SetColWidth(sheetSoal, "B", "B", 40)
	f.SetColWidth(sheetSoal, "C", "F", 25)
	f.SetColWidth(sheetSoal, "G", "G", 15)
	f.SetColWidth(sheetSoal, "H", "H", 15)

	// Berikan catatan (comment) pada header Kategori ID
	f.AddComment(sheetSoal, excelize.Comment{
		Cell:   "A1",
		Author: "Sistem",
		Paragraph: []excelize.RichTextRun{
			{Text: "Catatan:\nSilakan lihat nilai Kategori ID pada sheet 'Kategori Soal'"},
		},
	})

	// Contoh Data Soal
	f.SetCellValue(sheetSoal, "A2", 1)
	f.SetCellValue(sheetSoal, "B2", "Siapakah Bapak Pandu Dunia?")
	f.SetCellValue(sheetSoal, "C2", "Baden Powell")
	f.SetCellValue(sheetSoal, "D2", "Ir. Soekarno")
	f.SetCellValue(sheetSoal, "E2", "Sri Sultan Hamengkubuwono IX")
	f.SetCellValue(sheetSoal, "F2", "Jenderal Sudirman")
	f.SetCellValue(sheetSoal, "G2", "A")
	f.SetCellValue(sheetSoal, "H2", 10)

	// Berikan border kosong untuk beberapa baris (misal 50 baris untuk template)
	for i := 2; i <= 51; i++ {
		f.SetCellStyle(sheetSoal, fmt.Sprintf("A%d", i), fmt.Sprintf("H%d", i), dataStyle)
	}

	// ===============================
	// Sheet 2: Kategori Soal
	// ===============================
	sheetKategori := "Kategori Soal"
	_, err = f.NewSheet(sheetKategori)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat sheet Kategori Soal: %w", err)
	}

	headersKategori := []string{"Kategori ID", "Nama Kategori"}
	for i, header := range headersKategori {
		col := string(rune('A'+i)) + "1"
		f.SetCellValue(sheetKategori, col, header)
	}
	f.SetCellStyle(sheetKategori, "A1", "B1", headerStyle)
	f.SetColWidth(sheetKategori, "A", "A", 15)
	f.SetColWidth(sheetKategori, "B", "B", 30)

	categories, _, err := s.categoryRepo.ListCategories(ctx, 1, 1000000, "")
	if err != nil {
		return nil, fmt.Errorf("gagal mengambil data kategori: %w", err)
	}

	for i, cat := range categories {
		row := i + 2
		f.SetCellValue(sheetKategori, fmt.Sprintf("A%d", row), cat.ID)
		f.SetCellValue(sheetKategori, fmt.Sprintf("B%d", row), cat.Name)
		f.SetCellStyle(sheetKategori, fmt.Sprintf("A%d", row), fmt.Sprintf("B%d", row), dataStyle)
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("gagal menulis file excel: %w", err)
	}

	return buf.Bytes(), nil
}
