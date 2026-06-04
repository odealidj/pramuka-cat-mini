/**
 * Auth Service — Fungsi-fungsi API untuk autentikasi
 * Semua komunikasi HTTP ke Backend dilakukan melalui httpClient terpusat
 */

import httpClient from '@/lib/http-client';
import type {
  ApiSuccessResponse,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  RegisterRequest,
  User,
} from '@/types/auth';

/**
 * Melakukan pendaftaran (registrasi) akun baru
 * POST /api/v1/auth/register
 */
export const registerApi = async (
  payload: RegisterRequest
): Promise<User> => {
  const res = await httpClient.post<ApiSuccessResponse<User>>(
    '/auth/register',
    payload
  );
  return res.data.data;
};

/**
 * Melakukan login ke Backend API
 * POST /api/v1/auth/login
 */
export const loginApi = async (
  credentials: LoginRequest
): Promise<LoginResponse> => {
  const res = await httpClient.post<ApiSuccessResponse<LoginResponse>>(
    '/auth/login',
    credentials
  );
  return res.data.data;
};

/**
 * Memperbarui access token menggunakan refresh token
 * POST /api/v1/auth/refresh
 */
export const refreshApi = async (
  refreshToken: string
): Promise<RefreshResponse> => {
  const res = await httpClient.post<ApiSuccessResponse<RefreshResponse>>(
    '/auth/refresh',
    { refresh_token: refreshToken }
  );
  return res.data.data;
};

/**
 * Melakukan logout — invalidasi sesi di Redis
 * POST /api/v1/protected/auth/logout
 * (Membutuhkan Authorization header yang sudah diinject oleh interceptor)
 */
export const logoutApi = async (): Promise<void> => {
  await httpClient.post('/protected/auth/logout');
};
