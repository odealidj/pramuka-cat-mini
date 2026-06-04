package domain

import (
	"time"

	"github.com/google/uuid"
)

type Question struct {
	ID            uuid.UUID  `json:"id"`
	CategoryID    *int32     `json:"category_id"`
	QuestionText  string     `json:"question_text"`
	OptionA       string     `json:"option_a"`
	OptionB       string     `json:"option_b"`
	OptionC       string     `json:"option_c"`
	OptionD       string     `json:"option_d"`
	CorrectAnswer string     `json:"correct_answer"`
	Weight        int32      `json:"weight"`
	CreatedAt     *time.Time `json:"created_at"`
}

type CreateQuestionRequest struct {
	CategoryID    *int32 `json:"category_id"`
	QuestionText  string `json:"question_text" validate:"required"`
	OptionA       string `json:"option_a" validate:"required"`
	OptionB       string `json:"option_b" validate:"required"`
	OptionC       string `json:"option_c" validate:"required"`
	OptionD       string `json:"option_d" validate:"required"`
	CorrectAnswer string `json:"correct_answer" validate:"required,oneof=A B C D"`
	Weight        int32  `json:"weight" validate:"required,min=1"`
}

type UpdateQuestionRequest struct {
	CategoryID    *int32 `json:"category_id"`
	QuestionText  string `json:"question_text" validate:"required"`
	OptionA       string `json:"option_a" validate:"required"`
	OptionB       string `json:"option_b" validate:"required"`
	OptionC       string `json:"option_c" validate:"required"`
	OptionD       string `json:"option_d" validate:"required"`
	CorrectAnswer string `json:"correct_answer" validate:"required,oneof=A B C D"`
	Weight        int32  `json:"weight" validate:"required,min=1"`
}

type ImportQuestionRow struct {
	Row           int    `json:"row"`
	CategoryID    *int32 `json:"category_id"`
	QuestionText  string `json:"question_text"`
	OptionA       string `json:"option_a"`
	OptionB       string `json:"option_b"`
	OptionC       string `json:"option_c"`
	OptionD       string `json:"option_d"`
	CorrectAnswer string `json:"correct_answer"`
	Weight        int32  `json:"weight"`
	IsValid       bool   `json:"is_valid"`
	Error         string `json:"error,omitempty"`
}

type ImportQuestionsPreviewResponse struct {
	TotalRows int                 `json:"total_rows"`
	ValidRows int                 `json:"valid_rows"`
	ErrorRows int                 `json:"error_rows"`
	Data      []ImportQuestionRow `json:"data"`
}

type ConfirmImportRequest struct {
	Questions []ImportQuestionRow `json:"questions" validate:"required"`
}
