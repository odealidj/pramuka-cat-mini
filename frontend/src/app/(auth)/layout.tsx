'use client';

/**
 * Layout untuk halaman (auth) — Login, dll.
 * Jika user sudah terautentikasi, langsung redirect ke /dashboard.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Spinner from '@/components/ui/Spinner';
import { FlameKindling } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  // Tampilkan spinner sementara cek sesi awal berlangsung
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#3B1F0A] via-[#5C3010] to-[#7C4318] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
          <FlameKindling size={28} className="text-amber-300" />
        </div>
        <Spinner size={24} className="text-amber-300" />
      </div>
    );
  }

  // Jika sudah login, jangan render form login (redirect terjadi di useEffect)
  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
