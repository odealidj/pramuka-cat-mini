'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import type {
  Question,
  CreateQuestionRequest,
  Category,
  CorrectAnswer,
} from '@/types/auth';

// ============================================================
// Zod Schema
// ============================================================
const schema = z.object({
  category_id: z.string().optional(),
  question_text: z.string().min(5, 'Teks soal minimal 5 karakter'),
  option_a: z.string().min(1, 'Pilihan A wajib diisi'),
  option_b: z.string().min(1, 'Pilihan B wajib diisi'),
  option_c: z.string().min(1, 'Pilihan C wajib diisi'),
  option_d: z.string().min(1, 'Pilihan D wajib diisi'),
  correct_answer: z.enum(['A', 'B', 'C', 'D']),
  weight: z.string().refine((v) => {
    const n = Number(v);
    return !isNaN(n) && n >= 1;
  }, 'Bobot minimal 1').refine((v) => {
    const n = Number(v);
    return n <= 100;
  }, 'Bobot maksimal 100'),
}).superRefine((data, ctx) => {
  const options = [
    { name: 'Pilihan A', val: data.option_a?.trim().toLowerCase(), path: 'option_a' as const },
    { name: 'Pilihan B', val: data.option_b?.trim().toLowerCase(), path: 'option_b' as const },
    { name: 'Pilihan C', val: data.option_c?.trim().toLowerCase(), path: 'option_c' as const },
    { name: 'Pilihan D', val: data.option_d?.trim().toLowerCase(), path: 'option_d' as const },
  ];

  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      if (options[i].val && options[j].val && options[i].val === options[j].val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options[j].name} tidak boleh sama dengan ${options[i].name}`,
          path: [options[j].path],
        });
      }
    }
  }
});

type FormValues = z.infer<typeof schema>;

// ============================================================
// Props
// ============================================================
interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  question?: Question | null;
  categories: Category[];
  onSubmit: (data: CreateQuestionRequest) => Promise<void>;
  apiError?: string | null;
}

// ============================================================
// Answer Options Config
// ============================================================
const answerOptions: { key: CorrectAnswer; label: string; color: string }[] = [
  { key: 'A', label: 'A', color: 'bg-blue-500' },
  { key: 'B', label: 'B', color: 'bg-emerald-500' },
  { key: 'C', label: 'C', color: 'bg-amber-500' },
  { key: 'D', label: 'D', color: 'bg-rose-500' },
];

// ============================================================
// Helper: Field wrapper
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
      <label className="block text-[#7C4318] text-sm font-bold mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = (hasErr?: boolean) =>
  `w-full px-3.5 py-2.5 rounded-xl border text-[#5C3010] font-medium text-sm placeholder:text-gray-400 outline-none transition-all ${
    hasErr
      ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-200'
      : 'border-[#E8DCC8] bg-[#FAF7F2] focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] hover:border-[#D4924A]/70'
  }`;

// ============================================================
// Main Component
// ============================================================
export default function QuestionFormModal({
  isOpen,
  onClose,
  mode,
  question,
  categories,
  onSubmit,
  apiError,
}: QuestionFormModalProps) {
  const isEdit = mode === 'edit';

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category_id: '',
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      weight: '1',
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const correctAnswer = watch('correct_answer');

  useEffect(() => {
    if (isEdit && question) {
      reset({
        category_id: question.category_id != null ? String(question.category_id) : '',
        question_text: question.question_text,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_answer: question.correct_answer,
        weight: String(question.weight),
      });
    } else if (!isEdit) {
      reset({
        category_id: '',
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 'A',
        weight: '1',
      });
    }
  }, [isEdit, question, reset, isOpen]);

  const handleFormSubmit = async (values: FormValues) => {
    const payload: CreateQuestionRequest = {
      category_id: values.category_id ? Number(values.category_id) : null,
      question_text: values.question_text,
      option_a: values.option_a,
      option_b: values.option_b,
      option_c: values.option_c,
      option_d: values.option_d,
      correct_answer: values.correct_answer,
      weight: Number(values.weight),
    };
    await onSubmit(payload);
  };

  const optionFields: { key: CorrectAnswer; field: 'option_a' | 'option_b' | 'option_c' | 'option_d' }[] = [
    { key: 'A', field: 'option_a' },
    { key: 'B', field: 'option_b' },
    { key: 'C', field: 'option_c' },
    { key: 'D', field: 'option_d' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Soal' : 'Tambah Soal Baru'}
      size="lg"
    >
      {apiError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 text-sm">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5" noValidate>

        {/* Row: Category + Weight */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kategori" error={errors.category_id?.message}>
            <select
              {...register('category_id')}
              disabled={isSubmitting}
              className={`${inputCls()} appearance-none cursor-pointer`}
            >
              <option value="">— Otomatis (Umum) —</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Bobot Soal" error={errors.weight?.message} required>
            <input
              type="number"
              min={1}
              max={100}
              placeholder="1 – 100"
              disabled={isSubmitting}
              {...register('weight')}
              className={inputCls(!!errors.weight)}
            />
          </Field>
        </div>

        {/* Question Text */}
        <Field label="Teks Soal / Pertanyaan" error={errors.question_text?.message} required>
          <textarea
            rows={3}
            placeholder="Tulis pertanyaan di sini..."
            disabled={isSubmitting}
            {...register('question_text')}
            className={`${inputCls(!!errors.question_text)} resize-none`}
          />
        </Field>

        {/* Answer Options — with correct answer selector */}
        <div>
          <p className="text-[#7C4318] text-sm font-bold mb-2">
            Pilihan Jawaban <span className="text-red-500">*</span>
            <span className="ml-2 text-gray-400 font-normal text-xs">
              (klik ikon ✓ untuk menandai jawaban benar)
            </span>
          </p>
          <div className="space-y-2">
            {optionFields.map(({ key, field }) => {
              const isCorrect = correctAnswer === key;
              const optCfg = answerOptions.find((o) => o.key === key)!;
              const hasError = !!errors[field];
              return (
                <div
                  key={key}
                  className={`flex flex-col p-2.5 rounded-2xl border transition-all shadow-sm ${
                    hasError
                      ? 'border-red-300 bg-red-50/60 focus-within:ring-2 focus-within:ring-red-200'
                      : isCorrect
                      ? 'border-emerald-400 bg-emerald-50/80 shadow-emerald-900/5'
                      : 'border-[#E8DCC8] bg-white focus-within:ring-2 focus-within:ring-[#D4924A]/30 focus-within:border-[#D4924A] hover:border-[#E8DCC8]/80'
                  }`}
                >
                  <div className="flex items-center gap-3 w-full">
                    {/* Letter badge */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm ${
                        isCorrect ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-[#D4924A] to-[#7C4318]'
                      }`}
                    >
                      {key}
                    </div>
                    {/* Input */}
                    <input
                      type="text"
                      placeholder={`Pilihan ${key}...`}
                      disabled={isSubmitting}
                      {...register(field)}
                      className="flex-1 text-sm text-[#5C3010] font-medium outline-none bg-transparent placeholder:text-gray-400"
                    />
                    {/* Correct answer toggle */}
                    <button
                      type="button"
                      onClick={() => setValue('correct_answer', key)}
                      className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
                        isCorrect
                          ? 'text-emerald-600 bg-emerald-100/80 shadow-inner'
                          : 'text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 border border-transparent hover:border-emerald-200'
                      }`}
                      title={`Jadikan pilihan ${key} sebagai jawaban benar`}
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
                  {hasError && (
                    <p className="text-red-500 text-xs mt-1 ml-10 flex items-center gap-1">
                      <AlertCircle size={11} />
                      {errors[field]?.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {/* Show validation errors for options */}
          {(errors.option_a || errors.option_b || errors.option_c || errors.option_d) && (
            <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} /> Periksa kembali pilihan jawaban Anda (wajib diisi dan tidak boleh duplikat)
            </p>
          )}
          {/* Hidden input for correct_answer registration */}
          <input type="hidden" {...register('correct_answer')} />
          {/* Jawaban benar indicator */}
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 shadow-sm">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>
              Jawaban benar yang terpilih adalah: <span className="font-extrabold ml-1">Pilihan {correctAnswer}</span>
            </span>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 pt-4 border-t border-[#E8DCC8] mt-2">
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
            {isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Soal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
