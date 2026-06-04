/**
 * Event (Jadwal Ujian) Service
 * Endpoints: /admin/events
 */

import httpClient from '@/lib/http-client';
import type {
  ApiSuccessResponse,
  Event,
  CreateEventRequest,
  UpdateEventRequest,
  EventParticipant,
  AddEventQuestionRequest,
  AddRandomEventQuestionsRequest,
  Question,
  PaginatedResponse,
} from '@/types/auth';

// ─── Event CRUD ──────────────────────────────────────────────────────────────

export const listEventsApi = async (
  page = 1,
  limit = 10,
  search = ''
): Promise<PaginatedResponse<Event>> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
  });
  const res = await httpClient.get<ApiSuccessResponse<Event[]>>(
    `/admin/events?${params.toString()}`
  );
  return { data: res.data.data, meta: res.data.meta! };
};

export const getEventApi = async (id: string): Promise<Event> => {
  const res = await httpClient.get<ApiSuccessResponse<Event>>(
    `/admin/events/${id}`
  );
  return res.data.data;
};

export const createEventApi = async (payload: CreateEventRequest): Promise<Event> => {
  const res = await httpClient.post<ApiSuccessResponse<Event>>(
    '/admin/events',
    payload
  );
  return res.data.data;
};

export const updateEventApi = async (
  id: string,
  payload: UpdateEventRequest
): Promise<Event> => {
  const res = await httpClient.put<ApiSuccessResponse<Event>>(
    `/admin/events/${id}`,
    payload
  );
  return res.data.data;
};

export const deleteEventApi = async (id: string): Promise<void> => {
  await httpClient.delete(`/admin/events/${id}`);
};

// ─── Event Questions ──────────────────────────────────────────────────────────

export const listEventQuestionsApi = async (
  eventId: string,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<Question>> => {
  const res = await httpClient.get<ApiSuccessResponse<Question[]>>(
    `/admin/events/${eventId}/questions?page=${page}&limit=${limit}`
  );
  return { data: res.data.data, meta: res.data.meta! };
};

export const addEventQuestionApi = async (
  eventId: string,
  payload: AddEventQuestionRequest
): Promise<void> => {
  await httpClient.post(`/admin/events/${eventId}/questions`, payload);
};

export const addRandomEventQuestionsApi = async (
  eventId: string,
  payload: AddRandomEventQuestionsRequest
): Promise<void> => {
  await httpClient.post(`/admin/events/${eventId}/random-questions`, payload);
};

export const removeEventQuestionApi = async (
  eventId: string,
  questionId: string
): Promise<void> => {
  await httpClient.delete(`/admin/events/${eventId}/questions/${questionId}`);
};

// ─── Event Participants ───────────────────────────────────────────────────────

export const listEventParticipantsApi = async (
  eventId: string,
  page = 1,
  limit = 50,
  search = ''
): Promise<PaginatedResponse<EventParticipant>> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
  });
  const res = await httpClient.get<ApiSuccessResponse<EventParticipant[]>>(
    `/admin/events/${eventId}/participants?${params.toString()}`
  );
  return { data: res.data.data, meta: res.data.meta! };
};

export const approveParticipantApi = async (
  eventId: string,
  approvalId: string
): Promise<void> => {
  await httpClient.put(`/admin/events/${eventId}/participants/${approvalId}/approve`, {});
};

export const revokeParticipantApi = async (
  eventId: string,
  approvalId: string
): Promise<void> => {
  await httpClient.put(`/admin/events/${eventId}/participants/${approvalId}/revoke`, {});
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportEventParticipantsApi = async (
  eventId: string,
  format: 'excel' | 'pdf'
): Promise<void> => {
  const res = await httpClient.get(
    `/admin/events/${eventId}/export?format=${format}`,
    { responseType: 'blob' }
  );

  const ext = format === 'excel' ? 'xlsx' : 'pdf';
  let filename = `PramukaCAT - Laporan Peserta.${ext}`;
  const disposition = res.headers['content-disposition'];
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
    if (match && match[1]) {
      filename = decodeURIComponent(match[1].trim());
    }
  }

  const blob = new Blob([res.data]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const removeEventParticipantApi = async (
  eventId: string,
  approvalId: string
): Promise<void> => {
  await httpClient.delete(`/admin/events/${eventId}/participants/${approvalId}`);
};

export const exportEventQuestionsApi = async (
  eventId: string,
  format: 'excel' | 'pdf',
  showKey: boolean
): Promise<void> => {
  const res = await httpClient.get(
    `/admin/events/${eventId}/questions/export?format=${format}&show_key=${showKey}`,
    { responseType: 'blob' }
  );

  const ext = format === 'excel' ? 'xlsx' : 'pdf';
  let filename = `PramukaCAT - Soal Ujian.${ext}`;
  const disposition = res.headers['content-disposition'];
  if (disposition) {
    // Match: filename="some name.ext" or filename=some name.ext
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
    if (match && match[1]) {
      filename = decodeURIComponent(match[1].trim());
    }
  }

  const blob = new Blob([res.data]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
