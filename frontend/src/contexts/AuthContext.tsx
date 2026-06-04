'use client';

/**
 * AuthContext — Global State Management untuk Autentikasi
 *
 * Menyediakan:
 * - user: data user yang sedang login
 * - isAuthenticated: boolean status auth
 * - isLoading: true saat silent refresh berlangsung di awal
 * - login(): memanggil API login, simpan token, update state
 * - logout(): memanggil API logout, bersihkan token, redirect
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  setInMemoryToken,
  getInMemoryToken,
} from '@/lib/http-client';
import { REFRESH_TOKEN_KEY } from '@/lib/constants';
import {
  loginApi,
  logoutApi,
  refreshApi,
} from '@/services/auth.service';
import type { UserInfo } from '@/types/auth';

// ============================================================
// Context Interface
// ============================================================
interface AuthContextValue {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<UserInfo>) => void;
}

// ============================================================
// Context Creation
// ============================================================
const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// Provider Component
// ============================================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true selama cek sesi awal

  /**
   * Saat aplikasi pertama kali dimuat, coba lakukan silent refresh
   * menggunakan refresh_token yang tersimpan di localStorage.
   * Ini memungkinkan user tetap login meski browser ditutup/refresh.
   */
  useEffect(() => {
    const silentRefresh = async () => {
      const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      if (!storedRefreshToken) {
        // Tidak ada token → user belum pernah login
        setIsLoading(false);
        return;
      }

      try {
        const data = await refreshApi(storedRefreshToken);
        // Simpan token baru ke memori & localStorage
        setInMemoryToken(data.access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);

        // Ambil info user dari dalam JWT atau dari endpoint profil
        // Untuk sekarang, kita decode info dasar dari token yang tersimpan
        // Kita akan ambil user info saat login dan simpan di state
        // Tapi karena refresh tidak mengembalikan user info, kita tetap gunakan
        // state yang sudah ada. Jika tidak ada, biarkan null dan AuthGuard handle.
        // CATATAN: Idealnya ada endpoint GET /protected/auth/me untuk ini.
        // Workaround: simpan user info di sessionStorage saat login.
        const storedUser = sessionStorage.getItem('pramuka_cat_user_info');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // Refresh token sudah expired/tidak valid → bersihkan
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        sessionStorage.removeItem('pramuka_cat_user_info');
        setInMemoryToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    silentRefresh();
  }, []);

  /**
   * Fungsi login — dipanggil dari halaman login
   */
  const login = useCallback(
    async (username: string, password: string) => {
      const data = await loginApi({ username, password });

      // Simpan access token di in-memory
      setInMemoryToken(data.access_token);

      // Simpan refresh token di localStorage (persisten)
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);

      // Simpan user info di sessionStorage (persisten per tab)
      sessionStorage.setItem(
        'pramuka_cat_user_info',
        JSON.stringify(data.user)
      );

      // Update React state
      setUser(data.user);

      // Redirect berdasarkan role
      if (data.user.role === 'super_admin') {
        router.push('/super-admin');
      } else {
        router.push('/dashboard');
      }
    },
    [router]
  );

  /**
   * Fungsi logout — dipanggil dari Navbar
   */
  const logout = useCallback(async () => {
    try {
      // Panggil Backend untuk invalidasi sesi di Redis (best-effort)
      if (getInMemoryToken()) {
        await logoutApi();
      }
    } catch {
      // Tidak perlu throw — tetap lanjutkan proses logout lokal
    } finally {
      // Bersihkan semua token & state
      setInMemoryToken(null);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      sessionStorage.removeItem('pramuka_cat_user_info');
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  const updateUser = useCallback((data: Partial<UserInfo>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      sessionStorage.setItem('pramuka_cat_user_info', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isAuthenticated = !!user && !!getInMemoryToken();

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
      updateUser,
    }),
    [user, isAuthenticated, isLoading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// Custom Hook
// ============================================================
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam <AuthProvider>');
  }
  return context;
}
