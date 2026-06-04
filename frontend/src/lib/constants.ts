/**
 * Konstanta global untuk konfigurasi API dan token storage
 */

// URL dasar Backend API
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';

// Key untuk menyimpan token di localStorage
export const ACCESS_TOKEN_KEY = 'pramuka_cat_access_token';
export const REFRESH_TOKEN_KEY = 'pramuka_cat_refresh_token';
export const USER_KEY = 'pramuka_cat_user';

export function getPhotoUrl(photoUrl?: string | null): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http')) return photoUrl;
  if (photoUrl.startsWith('data:image')) return photoUrl;
  if (photoUrl.startsWith('blob:')) return photoUrl;

  // Asumsikan photoUrl seperti "/uploads/..."
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';
  try {
    const urlObj = new URL(baseUrl);
    return `${urlObj.origin}${photoUrl}`;
  } catch {
    // Fallback jika baseUrl relatif
    return `http://localhost:8080${photoUrl}`;
  }
}
