/**
 * HTTP Client terpusat berbasis Axios
 *
 * Fitur:
 * 1. Base URL terkonfigurasi dari konstanta
 * 2. Request interceptor: inject Authorization header otomatis
 * 3. Response interceptor: silent auto-refresh saat 401 Unauthorized
 *    - Jika refresh berhasil → simpan token baru & retry request asal
 *    - Jika refresh gagal → hapus semua token & redirect ke /login
 */

import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL, REFRESH_TOKEN_KEY } from './constants';
import type { ApiSuccessResponse, RefreshResponse } from '@/types/auth';

// ============================================================
// In-Memory Access Token Store
// Lebih aman dari localStorage karena tidak bisa diakses JS lain
// ============================================================
let _accessToken: string | null = null;

export const setInMemoryToken = (token: string | null) => {
  _accessToken = token;
};

export const getInMemoryToken = (): string | null => {
  return _accessToken;
};

// ============================================================
// Axios Instance
// ============================================================
const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// Request Interceptor — inject Bearer token
// ============================================================
httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (_accessToken) {
      config.headers.Authorization = `Bearer ${_accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// Response Interceptor — silent token refresh
// ============================================================
let isRefreshing = false;
// Queue untuk request yang pending selama refresh berlangsung
type FailedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};
let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // Hanya handle 401 yang belum pernah di-retry
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Jangan refresh jika ini adalah endpoint login/refresh itu sendiri
    const requestUrl = originalRequest.url || '';
    if (
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Antrekan request selama refresh berlangsung
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
          }
          return httpClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    // Ambil refresh token dari localStorage
    const refreshToken =
      typeof window !== 'undefined'
        ? localStorage.getItem(REFRESH_TOKEN_KEY)
        : null;

    if (!refreshToken) {
      // Tidak ada refresh token → paksa logout
      processQueue(error, null);
      isRefreshing = false;
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    try {
      // Gunakan axios langsung (bukan httpClient) agar tidak loop infinite
      const res = await axios.post<ApiSuccessResponse<RefreshResponse>>(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken }
      );

      const { access_token, refresh_token: newRefreshToken } = res.data.data;

      // Simpan token baru
      setInMemoryToken(access_token);
      if (typeof window !== 'undefined') {
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
      }

      // Retry semua request yang sedang antri
      processQueue(null, access_token);

      // Retry request asal
      if (originalRequest.headers) {
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
      }
      return httpClient(originalRequest);
    } catch (refreshError) {
      // Refresh gagal → bersihkan semua token & paksa login ulang
      processQueue(refreshError, null);
      setInMemoryToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default httpClient;
