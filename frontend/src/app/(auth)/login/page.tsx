'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FlameKindling, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Spinner from '@/components/ui/Spinner';
import { isAxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types/auth';
import Link from 'next/link';

// ============================================================
// Zod Schema — Validasi Form
// ============================================================
const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Username wajib diisi')
    .min(3, 'Username minimal 3 karakter'),
  password: z
    .string()
    .min(1, 'Password wajib diisi')
    .min(6, 'Password minimal 6 karakter'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ============================================================
// Login Page Component
// ============================================================
export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setApiError(null);
    try {
      await login(values.username, values.password);
    } catch (err) {
      // Tangkap error dari API dan tampilkan pesan yang user-friendly
      if (isAxiosError(err)) {
        const errData = err.response?.data as ApiErrorResponse | undefined;
        setApiError(
          errData?.message ||
            'Username atau password salah. Silakan coba lagi.'
        );
      } else {
        setApiError('Terjadi kesalahan. Silakan coba beberapa saat lagi.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1C1005] via-[#3B1F0A] to-[#1C1005] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Decorative background blobs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#D4924A]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#9C5A22]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden ring-1 ring-white/10">

          {/* Card Header */}
          <div className="bg-gradient-to-r from-[#FAF7F2] to-white px-10 py-10 text-center relative overflow-hidden border-b border-[#E8DCC8]">
            {/* Decorative elements in header */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#D4924A]/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#9C5A22]/5 to-transparent rounded-full translate-y-1/3 -translate-x-1/3" />

            <div className="relative inline-flex w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-white to-[#FAF7F2] border border-[#E8DCC8] shadow-sm items-center justify-center mb-5 z-10 transition-transform hover:scale-105 duration-500">
              <FlameKindling size={36} className="text-[#D4924A]" />
            </div>
            <h1 className="relative z-10 text-[#5C3010] text-3xl font-black tracking-tight">
              Pramuka CAT
            </h1>
            <p className="relative z-10 text-[#7A4520] text-sm font-extrabold mt-1.5 uppercase tracking-widest">
              Sistem Computer Assisted Test
            </p>
          </div>

          {/* Card Body — Form */}
          <div className="px-10 py-10">
            <div className="mb-8">
              <h2 className="text-[#5C3010] text-2xl font-extrabold tracking-tight">
                Selamat Datang! 👋
              </h2>
              <p className="text-[#7A4520] text-sm font-medium mt-1.5">
                Silakan masuk untuk melanjutkan ke sistem
              </p>
            </div>

            {/* API Error Banner */}
            {apiError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-600 text-sm font-medium">{apiError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

              {/* Username Field */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-[#5C3010] text-sm font-bold mb-2"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Masukkan username Anda"
                  disabled={isSubmitting}
                  {...register('username')}
                  className={`w-full px-4 py-3.5 rounded-xl border-2 text-gray-800 text-sm font-medium placeholder:text-gray-400 outline-none transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed
                    ${errors.username
                      ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                      : 'border-[#E8DCC8] bg-[#FAF7F2]/50 hover:bg-[#FAF7F2] focus:bg-white focus:border-[#D4924A] focus:ring-4 focus:ring-[#D4924A]/10'
                    }`}
                />
                {errors.username && (
                  <p className="text-red-500 text-xs font-bold mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-[#5C3010] text-sm font-bold mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={isSubmitting}
                    {...register('password')}
                    className={`w-full px-4 py-3.5 pr-12 rounded-xl border-2 text-gray-800 text-sm font-medium placeholder:text-gray-400 outline-none transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed
                      ${errors.password
                        ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                        : 'border-[#E8DCC8] bg-[#FAF7F2]/50 hover:bg-[#FAF7F2] focus:bg-white focus:border-[#D4924A] focus:ring-4 focus:ring-[#D4924A]/10'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#D4924A] transition-colors p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs font-bold mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                id="btn-login"
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#9C5A22] to-[#5C3010] text-white font-bold py-4 rounded-xl hover:from-[#7C4318] hover:to-[#3B1F0A] transition-all duration-300 shadow-xl shadow-[#9C5A22]/20 hover:shadow-2xl hover:shadow-[#9C5A22]/30 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-6"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size={18} className="text-white/80" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>
          </div>

          {/* Card Footer */}
          <div className="px-10 pb-8 pt-6 text-center border-t border-gray-100 bg-gray-50/50">
            <p className="text-[#7A4520] text-sm font-medium mb-4">
              Belum punya akun?{' '}
              <Link href="/register" className="text-[#D4924A] font-bold hover:text-[#9C5A22] transition-colors underline decoration-2 underline-offset-4 decoration-[#D4924A]/30 hover:decoration-[#9C5A22]">
                Daftar di sini
              </Link>
            </p>
            <p className="text-gray-400 text-xs font-medium">
              © {new Date().getFullYear()} Gerakan Pramuka — Sistem Ujian Digital
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
