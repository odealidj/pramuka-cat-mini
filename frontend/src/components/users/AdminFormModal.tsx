'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import type { User, CreateUserRequest, UpdateUserRequest } from '@/types/auth';
import { uploadImageApi } from '@/services/upload.service';
import imageCompression from 'browser-image-compression';
import { getPhotoUrl } from '@/lib/constants';

// ============================================================
// Zod Schemas
// ============================================================
const createSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  full_name: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  role: z.enum(['admin']),
  photo_url: z.string().optional().or(z.literal('')),
});

const editSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter'),
  email: z.string().email('Format email tidak valid'),
  full_name: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  role: z.enum(['admin']),
  photo_url: z.string().optional().or(z.literal('')),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

// ============================================================
// Props
// ============================================================
interface AdminFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  user?: User | null;
  onSubmit: (
    data: CreateUserRequest | UpdateUserRequest
  ) => Promise<void>;
  apiError?: string | null;
}

// ============================================================
// Shared Field Component
// ============================================================
function Field({
  label,
  error,
  children,
  required,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[#5C3010] text-sm font-bold mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass = (hasError?: boolean) =>
  `w-full px-3.5 py-2.5 rounded-xl border text-[#5C3010] text-sm placeholder:text-gray-400 outline-none transition-all font-medium bg-[#FAF7F2]/50 ${
    hasError
      ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
      : 'border-[#E8DCC8] focus:bg-white focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] shadow-sm'
  }`;

// ============================================================
// Main Component
// ============================================================
export default function AdminFormModal({
  isOpen,
  onClose,
  mode,
  user,
  onSubmit,
  apiError,
}: AdminFormModalProps) {
  const isEdit = mode === 'edit';
  const [photoMode, setPhotoMode] = useState<'url' | 'file'>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues | EditFormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema) as never,
    defaultValues: {
      username: '',
      email: '',
      password: '',
      full_name: '',
      role: 'admin',
      photo_url: '',
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (isEdit && user) {
      reset({
        username: user.username,
        email: user.email ?? '',
        full_name: user.full_name,
        role: 'admin',
        photo_url: user.photo_url ?? '',
      });
    } else if (!isEdit) {
      reset({
        username: '',
        email: '',
        password: '',
        full_name: '',
        role: 'admin',
        photo_url: '',
      });
    }
    
    // Reset file state on open/close
    setSelectedFile(null);
    setPhotoMode(isEdit && user?.photo_url ? 'url' : 'file');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [isEdit, user, reset, isOpen]);

  const [previewFile, setPreviewFile] = useState<string | null>(null);
  useEffect(() => {
    if (selectedFile) {
      const obj = URL.createObjectURL(selectedFile);
      setPreviewFile(obj);
      return () => URL.revokeObjectURL(obj);
    } else {
      setPreviewFile(null);
    }
  }, [selectedFile]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const photoUrlValue = watch('photo_url');
  const finalPreview = photoMode === 'file' ? previewFile : (photoUrlValue ? getPhotoUrl(photoUrlValue) : null);

  const handleFormSubmit = async (values: CreateFormValues | EditFormValues) => {
    let finalPhotoUrl = values.photo_url || undefined;

    // Handle file upload if mode is 'file' and file is selected
    if (photoMode === 'file' && selectedFile) {
      try {
        const options = {
          maxSizeMB: 0.05, // 50KB max
          maxWidthOrHeight: 400,
          useWebWorker: true,
          fileType: 'image/webp' as const,
        };
        const compressedFile = await imageCompression(selectedFile, options);
        finalPhotoUrl = await uploadImageApi(compressedFile);
      } catch (error) {
        console.error('Failed to compress/upload image', error);
        alert('Gagal mengunggah foto profil');
        return; // Stop submission on upload failure
      }
    }

    const payload = {
      ...values,
      photo_url: finalPhotoUrl,
    };
    await onSubmit(payload as CreateUserRequest | UpdateUserRequest);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Data Admin' : 'Tambah Admin Baru'}
    >
      {apiError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 text-sm">{apiError}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="space-y-4"
        noValidate
      >
        {/* Full Name */}
        <Field label="Nama Lengkap" error={errors.full_name?.message} required>
          <input
            type="text"
            placeholder="Contoh: Budi Santoso"
            disabled={isSubmitting}
            {...register('full_name')}
            className={inputClass(!!errors.full_name)}
          />
        </Field>

        {/* Username */}
        <Field label="Username" error={errors.username?.message} required>
          <input
            type="text"
            placeholder="Contoh: budi_santoso"
            disabled={isSubmitting}
            {...register('username')}
            className={inputClass(!!errors.username)}
          />
        </Field>

        {/* Email */}
        <Field label="Email" error={errors.email?.message} required>
          <input
            type="email"
            placeholder="Contoh: budi@gmail.com"
            disabled={isSubmitting}
            {...register('email')}
            className={inputClass(!!errors.email)}
          />
        </Field>

        {/* Password — only on create */}
        {!isEdit && (
          <Field
            label="Password"
            error={(errors as { password?: { message?: string } }).password?.message}
            required
          >
            <input
              type="password"
              placeholder="Minimal 6 karakter"
              disabled={isSubmitting}
              {...register('password' as never)}
              className={inputClass(!!(errors as { password?: unknown }).password)}
            />
          </Field>
        )}

        {/* Role */}
        <input type="hidden" {...register('role')} value="admin" />

        {/* Photo Input Mode Toggle */}
        <div className="pt-2">
          <label className="block text-[#5C3010] text-sm font-bold mb-2">Foto Profil (Opsional)</label>
          <div className="flex gap-1 mb-3 bg-[#FAF7F2] p-1.5 rounded-xl w-max border border-[#E8DCC8] shadow-sm">
            <button
              type="button"
              onClick={() => setPhotoMode('url')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                photoMode === 'url' ? 'bg-gradient-to-r from-[#7C4318] to-[#5C3010] text-white shadow-md shadow-[#7C4318]/20' : 'hover:bg-[#E8DCC8] text-[#9C5A22]'
              }`}
            >
              Gunakan URL
            </button>
            <button
              type="button"
              onClick={() => setPhotoMode('file')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                photoMode === 'file' ? 'bg-gradient-to-r from-[#7C4318] to-[#5C3010] text-white shadow-md shadow-[#7C4318]/20' : 'hover:bg-[#E8DCC8] text-[#9C5A22]'
              }`}
            >
              Unggah File
            </button>
          </div>

          {photoMode === 'url' ? (
            <div>
              <input
                type="url"
                placeholder="https://example.com/foto.jpg"
                disabled={isSubmitting}
                {...register('photo_url')}
                className={inputClass(!!errors.photo_url)}
              />
              {errors.photo_url?.message && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} />
                  {errors.photo_url.message}
                </p>
              )}
            </div>
          ) : (
            <div>
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                disabled={isSubmitting}
                ref={fileInputRef}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-[#7A4520] font-medium file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-[#FAF7F2] file:text-[#9C5A22] hover:file:bg-[#E8DCC8] transition-all border border-[#E8DCC8] rounded-xl cursor-pointer bg-white shadow-sm"
              />
              <p className="text-xs text-gray-400 mt-2">
                File akan otomatis dikompres ke WebP ({'< 50KB'}).
              </p>
            </div>
          )}
          
          {/* Image Preview */}
          {finalPreview && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Preview Foto:</p>
              <div className="w-16 h-16 rounded-full border-2 border-amber-200 overflow-hidden shadow-sm">
                <img src={finalPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E8DCC8] bg-white text-[#9C5A22] text-sm font-bold hover:bg-[#FAF7F2] hover:text-[#5C3010] transition-all disabled:opacity-50 shadow-sm"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C4318] to-[#9C5A22] text-white text-sm font-semibold hover:from-[#5C3010] hover:to-[#7C4318] transition-all disabled:opacity-70 shadow-sm shadow-amber-900/20"
          >
            {isSubmitting && <Spinner size={14} className="text-white" />}
            {isSubmitting
              ? 'Menyimpan...'
              : isEdit
              ? 'Simpan Perubahan'
              : 'Tambah Admin'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
