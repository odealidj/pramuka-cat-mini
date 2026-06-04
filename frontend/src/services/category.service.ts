/**
 * Category Service — API untuk manajemen kategori soal
 * Endpoint: /admin/categories
 * Catatan: Category ID adalah integer (bukan UUID)
 */

import httpClient from '@/lib/http-client';
import type {
  ApiSuccessResponse,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  PaginatedResponse,
} from '@/types/auth';

/** GET /admin/categories?page=&limit=&search= */
export const listCategoriesApi = async (
  page = 1,
  limit = 100,
  search = ''
): Promise<PaginatedResponse<Category>> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
  });
  const res = await httpClient.get<ApiSuccessResponse<Category[]>>(
    `/admin/categories?${params.toString()}`
  );
  return { data: res.data.data, meta: res.data.meta! };
};

/** POST /admin/categories */
export const createCategoryApi = async (
  payload: CreateCategoryRequest
): Promise<Category> => {
  const res = await httpClient.post<ApiSuccessResponse<Category>>(
    '/admin/categories',
    payload
  );
  return res.data.data;
};

/** PUT /admin/categories/:id */
export const updateCategoryApi = async (
  id: number,
  payload: UpdateCategoryRequest
): Promise<Category> => {
  const res = await httpClient.put<ApiSuccessResponse<Category>>(
    `/admin/categories/${id}`,
    payload
  );
  return res.data.data;
};

/** DELETE /admin/categories/:id */
export const deleteCategoryApi = async (id: number): Promise<void> => {
  await httpClient.delete(`/admin/categories/${id}`);
};

/** GET /admin/categories/export/excel */
export const exportCategoriesExcelApi = async (): Promise<Blob> => {
  const res = await httpClient.get<Blob>('/admin/categories/export/excel', {
    responseType: 'blob',
  });
  return res.data;
};

/** GET /admin/categories/export/pdf */
export const exportCategoriesPdfApi = async (): Promise<Blob> => {
  const res = await httpClient.get<Blob>('/admin/categories/export/pdf', {
    responseType: 'blob',
  });
  return res.data;
};
