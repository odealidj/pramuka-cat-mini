import httpClient from '@/lib/http-client';
import type { PaginatedResponse, ApiSuccessResponse, UserAnswerDetail } from '@/types/auth';

// Tipe data untuk daftar ujian mendatatng (Upcoming Events)
export interface UpcomingEvent {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  passing_grade: number;
  total_questions: number;
}

// Tipe data riwayat ujian (My Exams)
export interface UserApproval {
  event_id: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  question_count: number;
  passing_grade: number;
  approval_id: string;
  status: 'pending' | 'approved' | 'revoked';
  is_completed: boolean;
  score: number;
  is_passed: boolean;
  started_at: string | null;
  completed_at: string | null;
  is_event_finished: boolean; // dihitung server: true jika end_time sudah lewat
}


export interface ParticipantQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  weight: number;
}

export interface SubmitAnswerRequest {
  question_id: string;
  selected_answer: string;
}

export interface FinishExamResponse {
  message: string;
  score: number;
  is_passed: boolean;
}

// ─── API Endpoints ──────────────────────────────────────────────────────────

export const listUpcomingEventsApi = async (
  page = 1,
  limit = 10
): Promise<PaginatedResponse<UpcomingEvent>> => {
  const res = await httpClient.get<ApiSuccessResponse<UpcomingEvent[]>>(
    `/protected/exams/upcoming?page=${page}&limit=${limit}`
  );
  return { data: res.data.data, meta: res.data.meta! };
};

export const listMyExamsApi = async (
  page = 1,
  limit = 10
): Promise<PaginatedResponse<UserApproval>> => {
  const res = await httpClient.get<ApiSuccessResponse<UserApproval[]>>(
    `/protected/exams/my-exams?page=${page}&limit=${limit}`
  );
  return { data: res.data.data, meta: res.data.meta! };
};

export const enrollApi = async (eventId: string): Promise<void> => {
  await httpClient.post('/protected/exams/enroll', { event_id: eventId });
};

export const startExamApi = async (eventId: string): Promise<ParticipantQuestion[]> => {
  const res = await httpClient.get<ApiSuccessResponse<ParticipantQuestion[]>>(
    `/protected/exams/${eventId}/start`
  );
  return res.data.data;
};

export const submitAnswerApi = async (
  eventId: string,
  payload: SubmitAnswerRequest
): Promise<void> => {
  await httpClient.post(`/protected/exams/${eventId}/submit-answer`, payload);
};

export const finishExamApi = async (eventId: string): Promise<FinishExamResponse> => {
  const res = await httpClient.post<ApiSuccessResponse<FinishExamResponse>>(
    `/protected/exams/${eventId}/finish`
  );
  return res.data.data;
};

export const reviewParticipantAnswersApi = async (approvalId: string): Promise<UserAnswerDetail[]> => {
  const res = await httpClient.get<ApiSuccessResponse<UserAnswerDetail[]>>(
    `/admin/exams/approvals/${approvalId}/answers`
  );
  return res.data.data;
};

export const getExamResultParticipantApi = async (eventId: string): Promise<UserAnswerDetail[]> => {
  const res = await httpClient.get<ApiSuccessResponse<UserAnswerDetail[]>>(
    `/protected/exams/my-results/${eventId}`
  );
  return res.data.data;
};

export const exportReviewParticipantAnswersApi = async (
  approvalId: string,
  params: {
    participant_name: string;
    event_name: string;
    score: number;
    passing_grade: number;
    is_passed: boolean;
  }
): Promise<void> => {
  const searchParams = new URLSearchParams({
    participant_name: params.participant_name,
    event_name: params.event_name,
    score: params.score.toString(),
    passing_grade: params.passing_grade.toString(),
    is_passed: params.is_passed.toString(),
  });

  const res = await httpClient.get(
    `/admin/exams/approvals/${approvalId}/answers/export-pdf?${searchParams.toString()}`,
    { responseType: 'blob' }
  );

  let filename = `PramukaCAT - Review Jawaban ${params.participant_name}.pdf`;
  const disposition = res.headers['content-disposition'];
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
    if (match && match[1]) {
      filename = decodeURIComponent(match[1].trim());
    }
  }

  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const exportReviewAnswersParticipantApi = async (
  eventId: string,
  params: {
    participant_name: string;
    event_name: string;
    score: number;
    passing_grade: number;
    is_passed: boolean;
  }
): Promise<void> => {
  const searchParams = new URLSearchParams({
    participant_name: params.participant_name,
    event_name: params.event_name,
    score: params.score.toString(),
    passing_grade: params.passing_grade.toString(),
    is_passed: params.is_passed.toString(),
  });

  const res = await httpClient.get(
    `/protected/exams/my-results/${eventId}/export-pdf?${searchParams.toString()}`,
    { responseType: 'blob' }
  );

  let filename = `PramukaCAT - Hasil Ujian ${params.participant_name}.pdf`;
  const disposition = res.headers['content-disposition'];
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
    if (match && match[1]) {
      filename = decodeURIComponent(match[1].trim());
    }
  }

  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
