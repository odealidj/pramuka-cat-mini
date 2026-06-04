package domain

type Category struct {
	ID            int32  `json:"id"`
	Name          string `json:"name"`
	QuestionCount int64  `json:"question_count"`
}

type CreateCategoryRequest struct {
	Name string `json:"name" validate:"required"`
}

type UpdateCategoryRequest struct {
	Name string `json:"name" validate:"required"`
}
