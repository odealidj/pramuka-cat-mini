/**
 * User Service — Fungsi-fungsi API untuk manajemen user (Admin)
 */

import axios from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import httpClient, { getInMemoryToken } from '@/lib/http-client';
import type {
  ApiSuccessResponse,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UpdatePasswordRequest,
  UpdateProfileRequest,
  PaginatedResponse,
} from '@/types/auth';

/** GET /admin/users?page=&limit=&search= */
export const listUsersApi = async (
  page = 1,
  limit = 10,
  search = ''
): Promise<PaginatedResponse<User>> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
  });
  const res = await httpClient.get<ApiSuccessResponse<User[]>>(
    `/admin/users?${params.toString()}`
  );
  return {
    data: res.data.data,
    meta: res.data.meta!,
  };
};

/** GET /admin/users/:id */
export const getUserApi = async (id: string): Promise<User> => {
  const res = await httpClient.get<ApiSuccessResponse<User>>(
    `/admin/users/${id}`
  );
  return res.data.data;
};

/** POST /admin/users */
export const createUserApi = async (
  payload: CreateUserRequest
): Promise<User> => {
  const res = await httpClient.post<ApiSuccessResponse<User>>(
    '/admin/users',
    payload
  );
  return res.data.data;
};

/** PUT /admin/users/:id */
export const updateUserApi = async (
  id: string,
  payload: UpdateUserRequest
): Promise<User> => {
  const res = await httpClient.put<ApiSuccessResponse<User>>(
    `/admin/users/${id}`,
    payload
  );
  return res.data.data;
};

/** PUT /admin/users/:id/password */
export const updateUserPasswordApi = async (
  id: string,
  payload: UpdatePasswordRequest
): Promise<void> => {
  await httpClient.put(`/admin/users/${id}/password`, payload);
};

/** DELETE /admin/users/:id */
export const deleteUserApi = async (id: string): Promise<void> => {
  await httpClient.delete(`/admin/users/${id}`);
};

/** POST /users/me/photo */
export const uploadPhotoApi = async (file: File): Promise<{ photo_url: string }> => {
  const formData = new FormData();
  formData.append('photo', file);

  const res = await axios.post<ApiSuccessResponse<{ photo_url: string }>>(
    `${API_BASE_URL}/protected/users/me/photo`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${getInMemoryToken()}`,
      },
    }
  );
  return res.data.data;
};

/** PUT /users/me */
export const updateProfileApi = async (
  payload: UpdateProfileRequest
): Promise<User> => {
  const res = await httpClient.put<ApiSuccessResponse<User>>(
    '/protected/users/me',
    payload
  );
  return res.data.data;
};

export const changePasswordApi = async (
  payload: any // Replace with UpdateProfilePasswordRequest if typed
): Promise<void> => {
  await httpClient.put('/protected/users/me/password', payload);
};

// === SUPER ADMIN ENDPOINTS ===

export const listAdminsApi = async (
  page = 1,
  limit = 10,
  search = ''
): Promise<PaginatedResponse<User>> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
  });
  const res = await httpClient.get<ApiSuccessResponse<User[]>>(
    `/super-admin/admins?${params.toString()}`
  );
  return {
    data: res.data.data,
    meta: res.data.meta!,
  };
};

export const getAdminApi = async (id: string): Promise<User> => {
  const res = await httpClient.get<ApiSuccessResponse<User>>(
    `/super-admin/admins/${id}`
  );
  return res.data.data;
};

export const createAdminApi = async (
  payload: CreateUserRequest
): Promise<User> => {
  const res = await httpClient.post<ApiSuccessResponse<User>>(
    '/super-admin/admins',
    payload
  );
  return res.data.data;
};

export const updateAdminApi = async (
  id: string,
  payload: UpdateUserRequest
): Promise<User> => {
  const res = await httpClient.put<ApiSuccessResponse<User>>(
    `/super-admin/admins/${id}`,
    payload
  );
  return res.data.data;
};

export const updateAdminPasswordApi = async (
  id: string,
  payload: UpdatePasswordRequest
): Promise<void> => {
  await httpClient.put(`/super-admin/admins/${id}/password`, payload);
};

export const deleteAdminApi = async (id: string): Promise<void> => {
  await httpClient.delete(`/super-admin/admins/${id}`);
};
