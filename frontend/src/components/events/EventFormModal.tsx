'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import type { Event, CreateEventRequest } from '@/types/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Convert ISO string to local datetime-local input value */
function isoToLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  // "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert datetime-local string to ISO (UTC) */
function localToIso(local: string): string {
  return new Date(local).toISOString();
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z
  .object({
    name: z.string().min(3, 'Nama minimal 3 karakter'),
    start_time: z.string().min(1, 'Waktu mulai wajib diisi'),
    end_time: z.string().min(1, 'Waktu selesai wajib diisi'),
    duration_minutes: z
      .string()
      .refine((v) => !isNaN(Number(v)) && Number(v) >= 1, 'Durasi minimal 1 menit'),
    passing_grade: z
      .string()
      .refine(
        (v) => !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100,
        'Nilai kelulusan antara 0–100'
      ),
  })
  .refine((d) => new Date(d.end_time) > new Date(d.start_time), {
    message: 'Waktu selesai harus setelah waktu mulai',
    path: ['end_time'],
  });

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────
interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  event?: Event | null;
  onSubmit: (data: CreateEventRequest) => Promise<void>;
  apiError?: string | null;
}

// ─── Field Wrapper ────────────────────────────────────────────────────────────
function Field({
  label,
  error,
  hint,
  children,
  required,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[#7C4318] text-sm font-bold mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[#9C5A22]/80 font-medium text-xs mt-1.5">{hint}</p>}
      {error && (
        <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = (hasErr?: boolean) =>
  `w-full px-3.5 py-2.5 rounded-xl border text-[#5C3010] font-medium text-sm placeholder:text-gray-400 outline-none transition-all shadow-sm ${
    hasErr
      ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
      : 'border-[#E8DCC8] bg-[#FAF7F2] focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] hover:border-[#D4924A]/70'
  }`;

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function EventFormModal({
  isOpen,
  onClose,
  mode,
  event,
  onSubmit,
  apiError,
}: EventFormModalProps) {
  const isEdit = mode === 'edit';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      start_time: '',
      end_time: '',
      duration_minutes: '60',
      passing_grade: '70',
    },
  });

  useEffect(() => {
    if (isEdit && event) {
      reset({
        name: event.name,
        start_time: isoToLocal(event.start_time),
        end_time: isoToLocal(event.end_time),
        duration_minutes: String(event.duration_minutes),
        passing_grade: String(event.passing_grade),
      });
    } else if (!isEdit && isOpen) { // Only set defaults when opening create mode
      const now = new Date();
      // Smart default: Next full hour
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
      now.setSeconds(0);
      now.setMilliseconds(0);
      
      const nextHour = new Date(now);
      
      const twoHoursLater = new Date(nextHour);
      twoHoursLater.setHours(twoHoursLater.getHours() + 1);

      reset({ 
        name: '', 
        start_time: isoToLocal(nextHour.toISOString()), 
        end_time: isoToLocal(twoHoursLater.toISOString()), 
        duration_minutes: '60', 
        passing_grade: '70' 
      });
    }
  }, [isEdit, event, reset, isOpen]);

  const handleFormSubmit = async (values: FormValues) => {
    const payload: CreateEventRequest = {
      name: values.name,
      start_time: localToIso(values.start_time),
      end_time: localToIso(values.end_time),
      duration_minutes: Number(values.duration_minutes),
      passing_grade: Number(values.passing_grade),
    };
    await onSubmit(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Jadwal Ujian' : 'Buat Jadwal Ujian Baru'}
    >
      {apiError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 text-sm">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 pt-2" noValidate>
        {/* Name */}
        <Field label="Nama Ujian" error={errors.name?.message} required>
          <input
            type="text"
            placeholder="Contoh: Ujian Kepramukaan Tingkat Penggalang"
            disabled={isSubmitting}
            {...register('name')}
            className={inputCls(!!errors.name)}
          />
        </Field>

        {/* Start & End Time */}
        <div className="grid grid-cols-2 gap-6">
          <Field label="Waktu Mulai" error={errors.start_time?.message} required>
            <input
              type="datetime-local"
              disabled={isSubmitting}
              {...register('start_time')}
              className={inputCls(!!errors.start_time)}
            />
          </Field>
          <Field label="Waktu Selesai" error={errors.end_time?.message} required>
            <input
              type="datetime-local"
              disabled={isSubmitting}
              {...register('end_time')}
              className={inputCls(!!errors.end_time)}
            />
          </Field>
        </div>

        {/* Duration & Passing Grade */}
        <div className="grid grid-cols-2 gap-6">
          <Field
            label="Durasi Pengerjaan (menit)"
            error={errors.duration_minutes?.message}
            hint="Waktu maksimal peserta mengerjakan soal"
            required
          >
            <input
              type="number"
              min={1}
              placeholder="60"
              disabled={isSubmitting}
              {...register('duration_minutes')}
              className={inputCls(!!errors.duration_minutes)}
            />
          </Field>
          <Field
            label="Nilai Kelulusan (%)"
            error={errors.passing_grade?.message}
            hint="Nilai minimum untuk dinyatakan lulus"
            required
          >
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              placeholder="70"
              disabled={isSubmitting}
              {...register('passing_grade')}
              className={inputCls(!!errors.passing_grade)}
            />
          </Field>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 pt-6 border-t border-[#E8DCC8] mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 rounded-xl border border-[#E8DCC8] bg-[#FAF7F2] text-[#9C5A22] text-sm font-bold hover:bg-[#E8DCC8] hover:text-[#5C3010] transition-all disabled:opacity-50 shadow-sm"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#7C4318] to-[#5C3010] text-white text-sm font-bold hover:from-[#5C3010] hover:to-[#4A260D] transition-all disabled:opacity-70 shadow-md shadow-[#7C4318]/20"
          >
            {isSubmitting && <Spinner size={16} className="text-white" />}
            {isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Ujian'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
