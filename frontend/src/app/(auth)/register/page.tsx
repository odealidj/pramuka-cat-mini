'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FlameKindling, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import { isAxiosError } from 'axios';
import { registerApi } from '@/services/auth.service';
import type { ApiErrorResponse } from '@/types/auth';

// ============================================================
// Zod Schema — Validasi Form
// ============================================================
const registerSchema = z.object({
  username: z
    .string()
    .min(1, 'Username wajib diisi')
    .min(3, 'Username minimal 3 karakter')
    .regex(/^[a-zA-Z0-9_]+$/, 'Hanya boleh huruf, angka, dan underscore (_)'),
  email: z
    .string()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid'),
  full_name: z
    .string()
    .min(1, 'Nama lengkap wajib diisi')
    .min(3, 'Nama lengkap minimal 3 karakter'),
  password: z
    .string()
    .min(1, 'Password wajib diisi')
    .min(6, 'Password minimal 6 karakter'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

// ============================================================
// Register Page Component
// ============================================================
export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      full_name: '',
      password: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setApiError(null);
    try {
      await registerApi({
        username: values.username,
        email: values.email,
        full_name: values.full_name,
        password: values.password,
      });
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      if (isAxiosError(err)) {
        const errData = err.response?.data as ApiErrorResponse | undefined;
        // Tangkap pesan error dari API, bisa berupa string (message) atau list of errors
        let errorMsg = 'Gagal melakukan pendaftaran. Silakan coba lagi.';
        if (errData?.message) errorMsg = errData.message;
        if (errData?.errors && errData.errors.length > 0) {
          errorMsg = errData.errors[0].message;
        }
        setApiError(errorMsg);
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

      <div className="relative w-full max-w-md py-8">
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
            <h1 className="relative z-10 text-[#5C3010] text-3xl font-black tracking-tight">Pramuka CAT</h1>
            <p className="relative z-10 text-[#7A4520] text-sm font-extrabold mt-1.5 uppercase tracking-widest">Pendaftaran Peserta Baru</p>
          </div>

          {/* Card Body — Form */}
          <div className="px-10 py-10">
            {isSuccess ? (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-emerald-50 to-emerald-100 mb-6 shadow-sm border border-emerald-200">
                  <FlameKindling size={36} className="text-emerald-500" />
                </div>
                <h2 className="text-[#5C3010] text-2xl font-extrabold tracking-tight mb-2">Pendaftaran Berhasil! 🎉</h2>
                <p className="text-[#7A4520] text-sm font-medium mb-8">Akun Anda telah berhasil dibuat. Anda akan dialihkan ke halaman login...</p>
                <Spinner size={28} className="text-emerald-500 mx-auto" />
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-[#5C3010] text-2xl font-extrabold tracking-tight">Buat Akun Baru</h2>
                  <p className="text-[#7A4520] text-sm font-medium mt-1.5">Lengkapi data di bawah ini untuk mendaftar</p>
                </div>

                {/* API Error Banner */}
                {apiError && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                    <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-600 text-sm font-medium">{apiError}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  {/* Nama Lengkap */}
                  <div>
                    <label htmlFor="full_name" className="block text-[#5C3010] text-sm font-bold mb-2">
                      Nama Lengkap
                    </label>
                    <input
                      id="full_name"
                      type="text"
                      placeholder="Masukkan nama lengkap Anda"
                      disabled={isSubmitting}
                      {...register('full_name')}
                      className={`w-full px-4 py-3.5 rounded-xl border-2 text-gray-800 text-sm font-medium placeholder:text-gray-400 outline-none transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed
                        ${
                          errors.full_name
                            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                            : 'border-[#E8DCC8] bg-[#FAF7F2]/50 hover:bg-[#FAF7F2] focus:bg-white focus:border-[#D4924A] focus:ring-4 focus:ring-[#D4924A]/10'
                        }`}
                    />
                    {errors.full_name && (
                      <p className="text-red-500 text-xs font-bold mt-1.5 flex items-center gap-1">
                        <AlertCircle size={12} /> {errors.full_name.message}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-[#5C3010] text-sm font-bold mb-2">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="contoh@email.com"
                      disabled={isSubmitting}
                      {...register('email')}
                      className={`w-full px-4 py-3.5 rounded-xl border-2 text-gray-800 text-sm font-medium placeholder:text-gray-400 outline-none transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed
                        ${
                          errors.email
                            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                            : 'border-[#E8DCC8] bg-[#FAF7F2]/50 hover:bg-[#FAF7F2] focus:bg-white focus:border-[#D4924A] focus:ring-4 focus:ring-[#D4924A]/10'
                        }`}
                    />
                    {errors.email && (
                      <p className="text-red-500 text-xs font-bold mt-1.5 flex items-center gap-1">
                        <AlertCircle size={12} /> {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Username Field */}
                  <div>
                    <label htmlFor="username" className="block text-[#5C3010] text-sm font-bold mb-2">
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
                        ${
                          errors.username
                            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                            : 'border-[#E8DCC8] bg-[#FAF7F2]/50 hover:bg-[#FAF7F2] focus:bg-white focus:border-[#D4924A] focus:ring-4 focus:ring-[#D4924A]/10'
                        }`}
                    />
                    {errors.username && (
                      <p className="text-red-500 text-xs font-bold mt-1.5 flex items-center gap-1">
                        <AlertCircle size={12} /> {errors.username.message}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <label htmlFor="password" className="block text-[#5C3010] text-sm font-bold mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        disabled={isSubmitting}
                        {...register('password')}
                        className={`w-full px-4 py-3.5 pr-12 rounded-xl border-2 text-gray-800 text-sm font-medium placeholder:text-gray-400 outline-none transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed
                          ${
                            errors.password
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
                        <AlertCircle size={12} /> {errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#9C5A22] to-[#5C3010] text-white font-bold py-4 rounded-xl hover:from-[#7C4318] hover:to-[#3B1F0A] transition-all duration-300 shadow-xl shadow-[#9C5A22]/20 hover:shadow-2xl hover:shadow-[#9C5A22]/30 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-6"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner size={18} className="text-white/80" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      'Daftar Sekarang'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Card Footer */}
          {!isSuccess && (
            <div className="px-10 pb-8 pt-6 text-center border-t border-gray-100 bg-gray-50/50">
              <p className="text-[#7A4520] text-sm font-medium">
                Sudah punya akun?{' '}
                <Link href="/login" className="text-[#D4924A] font-bold hover:text-[#9C5A22] transition-colors underline decoration-2 underline-offset-4 decoration-[#D4924A]/30 hover:decoration-[#9C5A22]">
                  Masuk di sini
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
