'use client';

/**
 * AuthGuard — Komponen proteksi rute
 *
 * Logika:
 * 1. Saat isLoading (silent refresh berlangsung) → tampilkan full-page loader
 * 2. Jika tidak terautentikasi → redirect ke /login
 * 3. Jika terautentikasi → render children
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Spinner from '@/components/ui/Spinner';
import { FlameKindling, ShieldAlert } from 'lucide-react';
import type { UserInfo } from '@/types/auth';

export default function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserInfo['role'][];
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.replace('/login');
        return;
      }

      // If allowedRoles is provided, check if user role is in it
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirection logic based on role
        if (user.role === 'super_admin') {
          router.replace('/super-admin');
        } else {
          router.replace('/dashboard');
        }
      }
    }
  }, [isLoading, isAuthenticated, user, router, allowedRoles]);

  // Menampilkan layar loading saat silent refresh berlangsung
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/25">
          <FlameKindling size={28} className="text-white" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Spinner size={24} className="text-amber-700" />
          <p className="text-gray-500 text-sm font-medium">
            Memverifikasi sesi...
          </p>
        </div>
      </div>
    );
  }

  // Jika tidak terautentikasi, jangan render apapun (redirect akan terjadi di useEffect)
  if (!isAuthenticated || !user) {
    return null;
  }

  // Jika tidak memiliki akses peran, jangan render konten
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Akses Ditolak</h2>
        <p className="text-gray-500 text-sm">
          Anda tidak memiliki wewenang untuk melihat halaman ini.
        </p>
        <Spinner size={24} className="text-gray-400 mt-4" />
      </div>
    );
  }

  return <>{children}</>;
}
