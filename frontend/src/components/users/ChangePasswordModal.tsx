'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, KeyRound } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';

const schema = z
  .object({
    password: z.string().min(6, 'Password minimal 6 karakter'),
    confirm_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Password tidak cocok',
    path: ['confirm_password'],
  });

type FormValues = z.infer<typeof schema>;

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onSubmit: (password: string) => Promise<void>;
  apiError?: string | null;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  userName,
  onSubmit,
  apiError,
}: ChangePasswordModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm_password: '' },
  });

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const onFormSubmit = async (values: FormValues) => {
    await onSubmit(values.password);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ganti Password" size="sm">
      <div className="flex items-center gap-3 mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <KeyRound size={16} className="text-amber-600 flex-shrink-0" />
        <p className="text-amber-800 text-sm">
          Mengatur ulang password untuk{' '}
          <span className="font-semibold">{userName}</span>
        </p>
      </div>

      {apiError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 text-sm">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" noValidate>
        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-1.5">
            Password Baru <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            placeholder="Minimal 6 karakter"
            disabled={isSubmitting}
            {...register('password')}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-gray-800 text-sm outline-none transition-all ${
              errors.password
                ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
                : 'border-gray-200 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400'
            }`}
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
              <AlertCircle size={11} /> {errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-1.5">
            Konfirmasi Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            placeholder="Ulangi password baru"
            disabled={isSubmitting}
            {...register('confirm_password')}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-gray-800 text-sm outline-none transition-all ${
              errors.confirm_password
                ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
                : 'border-gray-200 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400'
            }`}
          />
          {errors.confirm_password && (
            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
              <AlertCircle size={11} /> {errors.confirm_password.message}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C4318] to-[#9C5A22] text-white text-sm font-semibold hover:from-[#5C3010] hover:to-[#7C4318] transition-all disabled:opacity-70 shadow-sm"
          >
            {isSubmitting && <Spinner size={14} className="text-white" />}
            {isSubmitting ? 'Menyimpan...' : 'Simpan Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
