/**
 * TypeScript interfaces yang mencerminkan domain structs dari Backend Go
 * Referensi: backend/internal/core/domain/auth.go & user.go
 */

// === Request Types ===

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  full_name: string;
}


// === Auth Response Types ===

/** Data user tanpa password hash (mirror dari UserResponse di Go) */
export interface UserInfo {
  id: string;
  username: string;
  email?: string | null;
  full_name: string;
  role: 'super_admin' | 'admin' | 'peserta';
  photo_url?: string | null;
  email_notifications: boolean;
}

/** Response sukses dari POST /auth/login */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UserInfo;
}

/** Response sukses dari POST /auth/refresh */
export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

// === User CRUD Types ===

/** Entitas User lengkap (mirror dari domain.User di Go) */
export interface User {
  id: string;
  username: string;
  email?: string | null;
  full_name: string;
  role: 'super_admin' | 'admin' | 'peserta';
  photo_url?: string | null;
  email_notifications: boolean;
  created_at: string;
  deleted_at?: string | null;
}

/** Request membuat user baru */
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'peserta';
  photo_url?: string;
}

/** Request update profil user */
export interface UpdateUserRequest {
  username: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'peserta';
  photo_url?: string;
}

/** Request ganti password user oleh admin */
export interface UpdatePasswordRequest {
  password: string;
}

export interface UpdateProfileRequest {
  username: string;
  email: string;
  full_name: string;
  email_notifications: boolean;
}

// === Pagination Types ===

export interface PaginationMeta {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// === Standard API Response Wrapper ===
// Mencerminkan format response standar dari pkg/response di Backend

export interface ApiSuccessResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
  trace_id?: string;
}

export interface ApiErrorResponse {
  success: boolean;
  code: number;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  trace_id?: string;
}

// === Category Types ===
// Catatan: Category.ID adalah int32 (bukan UUID)

export interface Category {
  id: number;
  name: string;
  question_count: number;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name: string;
}

// === Question Types ===

export type CorrectAnswer = 'A' | 'B' | 'C' | 'D';

export interface Question {
  id: string;
  category_id: number | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: CorrectAnswer;
  weight: number;
  created_at: string | null;
}

export interface CreateQuestionRequest {
  category_id?: number | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: CorrectAnswer;
  weight: number;
}

export type UpdateQuestionRequest = CreateQuestionRequest;

export interface ImportQuestionRow {
  row: number;
  category_id: number | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: CorrectAnswer;
  weight: number;
  is_valid: boolean;
  error?: string;
}

export interface ImportQuestionsPreviewResponse {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  data: ImportQuestionRow[];
}

export interface ConfirmImportRequest {
  questions: ImportQuestionRow[];
}

// === Event / Jadwal Ujian Types ===

export interface Event {
  id: string;
  name: string;
  start_time: string;   // ISO 8601
  end_time: string;     // ISO 8601
  duration_minutes: number;
  passing_grade: number;
  total_questions?: number;
  created_at: string;
}

export interface CreateEventRequest {
  name: string;
  start_time: string;   // ISO 8601
  end_time: string;     // ISO 8601
  duration_minutes: number;
  passing_grade: number;
}

export type UpdateEventRequest = CreateEventRequest;

export interface EventParticipant {
  user_id: string;
  approval_id: string;
  username: string;
  full_name: string;
  status: string;       // "pending" | "approved"
  is_completed: boolean;
  score: number;
  is_passed: boolean;
}

export interface AddEventQuestionRequest {
  question_id: string;
}

export interface AddRandomEventQuestionsRequest {
  category_id?: number | null;
  amount: number;
}

// === Hasil Ujian / Exam Result Types ===

/** Riwayat pendaftaran + hasil ujian peserta (dipakai admin via event participants) */
export interface UserApproval {
  event_id: string;
  name: string;             // nama event
  start_time: string;
  end_time: string;
  duration_minutes: number;
  passing_grade: number;
  approval_id: string;
  status: string;           // "pending" | "approved" | "revoked"
  is_completed: boolean;
  score: number;
  is_passed: boolean;
  started_at: string | null;
  completed_at: string | null;
}

/** Detail per soal — jawaban peserta + kunci jawaban (untuk review admin) */
export interface UserAnswerDetail {
  answer_id: string;
  selected_answer: string;  // A | B | C | D
  is_correct: boolean;
  question_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;   // A | B | C | D
  weight: number;
}
