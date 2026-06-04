'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  XCircle,
  BookOpen,
  Download,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import StatCard from '@/components/ui/StatCard';
import { ToastContainer, useToast } from '@/components/ui/Toast';

import {
  listCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  deleteCategoryApi,
  exportCategoriesExcelApi,
  exportCategoriesPdfApi,
} from '@/services/category.service';
import type {
  Category,
  PaginationMeta,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  ApiErrorResponse,
} from '@/types/auth';

// ============================================================
// Form Validation Schema
// ============================================================
const schema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
});
type FormValues = z.infer<typeof schema>;

// ============================================================
// Helper — format date
// ============================================================
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ============================================================
// Page Component
// ============================================================
export default function CategoriesPage() {
  const router = useRouter();
  // --- Data State ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // --- Modal & Action States ---
  const [formModal, setFormModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    category: Category | null;
  }>({ open: false, mode: 'create', category: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    category: Category | null;
    isLoading: boolean;
  }>({ open: false, category: null, isLoading: false });

  // --- Error State for Forms ---
  const [formApiError, setFormApiError] = useState<string | null>(null);

  // --- Toast ---
  const { toasts, toast, dismiss } = useToast();

  // --- React Hook Form ---
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // ============================================================
  // Fetch Categories
  // ============================================================
  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get categories with search and page (limit 10 for paginated view)
      const res = await listCategoriesApi(page, 10, search);
      setCategories(res.data);
      setMeta(res.meta);
    } catch {
      toast('error', 'Gagal memuat data kategori soal.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Debounced search — trigger after 500ms typing stop
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Set form field values when category to edit changes
  useEffect(() => {
    if (formModal.open && formModal.mode === 'edit' && formModal.category) {
      setValue('name', formModal.category.name);
    } else if (formModal.open && formModal.mode === 'create') {
      reset({ name: '' });
    }
  }, [formModal, setValue, reset]);

  // ============================================================
  // Save Category (Create/Update)
  // ============================================================
  const handleSave = async (values: FormValues) => {
    setFormApiError(null);
    try {
      if (formModal.mode === 'create') {
        await createCategoryApi(values as CreateCategoryRequest);
        toast('success', `Kategori "${values.name}" berhasil dibuat.`);
      } else if (formModal.mode === 'edit' && formModal.category) {
        await updateCategoryApi(formModal.category.id, values as UpdateCategoryRequest);
        toast('success', `Kategori berhasil diubah menjadi "${values.name}".`);
      }
      setFormModal({ open: false, mode: 'create', category: null });
      reset({ name: '' });
      fetchCategories();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as ApiErrorResponse)?.message ?? 'Gagal menyimpan kategori.'
        : 'Terjadi kesalahan.';
      setFormApiError(msg);
    }
  };

  // ============================================================
  // Delete Category
  // ============================================================
  const handleDelete = async () => {
    if (!deleteDialog.category) return;
    setDeleteDialog((d) => ({ ...d, isLoading: true }));
    try {
      await deleteCategoryApi(deleteDialog.category.id);
      toast('success', `Kategori "${deleteDialog.category.name}" berhasil dihapus.`);
      setDeleteDialog({ open: false, category: null, isLoading: false });
      fetchCategories();
    } catch {
      toast('error', 'Gagal menghapus kategori.');
      setDeleteDialog((d) => ({ ...d, isLoading: false }));
    }
  };

  const handleExport = async (type: 'excel' | 'pdf') => {
    try {
      let blob: Blob;
      let filename: string;
      if (type === 'excel') {
        blob = await exportCategoriesExcelApi();
        filename = 'Kategori_Soal.xlsx';
      } else {
        blob = await exportCategoriesPdfApi();
        filename = 'Kategori_Soal.pdf';
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast('error', `Gagal mengekspor data ${type.toUpperCase()}.`);
    }
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#5C3010] tracking-tight mb-1">Kategori Soal</h1>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] flex items-center justify-center flex-shrink-0 border border-[#E8DCC8]">
              <Tag size={16} className="text-[#9C5A22]" />
            </div>
            <p className="text-[#7C4318] text-sm font-medium">
              Kelola rumpun/kategori materi untuk pengelompokan bank soal
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 mr-2">
            <button
              onClick={() => handleExport('excel')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E8DCC8] rounded-full text-sm font-bold text-[#7C4318] hover:bg-[#FAF7F2] hover:border-[#D4924A] transition-all shadow-sm group"
            >
              <FileSpreadsheet size={16} className="text-emerald-600 group-hover:text-[#9C5A22] transition-colors" />
              Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E8DCC8] rounded-full text-sm font-bold text-[#7C4318] hover:bg-[#FAF7F2] hover:border-[#D4924A] transition-all shadow-sm group"
            >
              <FileText size={16} className="text-red-600 group-hover:text-[#9C5A22] transition-colors" />
              PDF
            </button>
          </div>
          <button
            onClick={() => {
              setFormApiError(null);
              setFormModal({ open: true, mode: 'create', category: null });
            }}
            id="btn-add-category"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#7C4318] to-[#5C3010] text-white text-sm font-bold rounded-xl shadow-md shadow-[#7C4318]/20 hover:from-[#5C3010] hover:to-[#4A260D] transition-all"
          >
            <Plus size={16} />
            Tambah Kategori
          </button>
        </div>
      </div>

      {/* ── Stats Card ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Kategori"
          value={meta?.total_records ?? '—'}
          icon={<Tag size={20} className="text-[#9C5A22]" />}
        />
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white rounded-2xl border border-[#E8DCC8] shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-5 border-b border-[#E8DCC8] bg-white">
          <div className="flex-1 flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2.5 border border-[#E8DCC8] focus-within:ring-2 focus-within:ring-[#D4924A]/30 focus-within:border-[#D4924A] transition-all relative shadow-sm">
            <Search size={16} className="text-[#9C5A22] flex-shrink-0" />
            <input
              type="text"
              placeholder="Cari kategori..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#5C3010] font-medium placeholder:text-gray-400 outline-none pr-6"
              id="search-categories"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                title="Hapus filter"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>
          <button
            onClick={fetchCategories}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8DCC8] bg-white text-[#9C5A22] hover:bg-[#FAF7F2] hover:text-[#5C3010] text-sm font-bold shadow-sm transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header-premium">
                <th className="table-header-cell-premium w-16">
                  No
                </th>
                <th className="table-header-cell-premium">
                  Nama Kategori
                </th>
                <th className="table-header-cell-premium text-center w-36">
                  Jumlah Soal
                </th>
                <th className="table-header-cell-premium text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Spinner size={24} className="text-amber-600" />
                      <span className="text-sm">Memuat data kategori...</span>
                    </div>
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Tag size={36} className="text-gray-200" />
                      <p className="text-sm font-medium text-gray-500">
                        {search ? `Tidak ada kategori dengan kata kunci "${search}"` : 'Belum ada kategori'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                categories.map((category, idx) => {
                  const rowNo = ((page - 1) * 10) + idx + 1;
                  return (
                    <tr
                      key={category.id}
                      className="table-row-premium group"
                    >
                      {/* No */}
                      <td className="px-5 py-4 text-gray-500 text-xs font-medium">{rowNo}</td>

                      {/* Nama Kategori */}
                      <td className="table-cell-premium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 flex-shrink-0">
                            <Tag size={14} />
                          </div>
                          <div>
                            <p className="text-gray-900 font-semibold text-sm group-hover:text-[#7C4318] transition-colors">
                              {category.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Jumlah Soal Badge */}
                      <td className="table-cell-premium text-center">
                        <button
                          onClick={() =>
                            router.push(`/dashboard/questions?category_id=${category.id}&category_name=${encodeURIComponent(category.name)}`)
                          }
                          title={`Lihat soal kategori ${category.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all
                            bg-amber-50 text-amber-700 border border-amber-200
                            hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm
                            active:scale-95"
                        >
                          <BookOpen size={12} />
                          {category.question_count} soal
                        </button>
                      </td>

                      {/* Aksi */}
                      <td className="table-cell-premium">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <button
                            onClick={() => {
                              setFormApiError(null);
                              setFormModal({ open: true, mode: 'edit', category });
                            }}
                            className="p-2 rounded-xl text-[#9C5A22] hover:text-[#5C3010] hover:bg-[#FAF7F2] border border-transparent hover:border-[#E8DCC8] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                            title="Edit kategori"
                            aria-label="Edit kategori"
                          >
                            <Edit2 size={15} />
                          </button>

                          {/* Hapus */}
                          <button
                            onClick={() =>
                              setDeleteDialog({ open: true, category, isLoading: false })
                            }
                            className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                            title="Hapus kategori"
                            aria-label="Hapus kategori"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta && meta.total_records > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <p className="text-gray-400 text-xs">
              Menampilkan {((page - 1) * 10) + 1}–
              {Math.min(page * 10, meta.total_records)} dari{' '}
              {meta.total_records} kategori
            </p>
            <Pagination
              page={page}
              totalPages={meta.total_pages}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* ── Add/Edit Category Modal ── */}
      <Modal
        isOpen={formModal.open}
        onClose={() => setFormModal((s) => ({ ...s, open: false }))}
        title={formModal.mode === 'create' ? 'Tambah Kategori Soal' : 'Edit Kategori Soal'}
        size="sm"
      >
        <form onSubmit={handleSubmit(handleSave)} className="space-y-4" noValidate>
          <div>
            <label className="block text-[#7C4318] text-sm font-bold mb-1.5">
              Nama Kategori Soal
            </label>
            <input
              type="text"
              placeholder="Contoh: PUPK, Sandi, Tali-temali..."
              {...register('name')}
              className="w-full px-3.5 py-2.5 rounded-xl border text-[#5C3010] font-medium text-sm placeholder:text-gray-400 outline-none transition-all shadow-sm border-[#E8DCC8] bg-[#FAF7F2] focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] hover:border-[#D4924A]/70"
              autoFocus
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
            {formApiError && (
              <p className="text-red-500 text-xs mt-1">{formApiError}</p>
            )}
          </div>

          <div className="flex gap-4 pt-6 border-t border-[#E8DCC8] mt-4">
            <button
              type="button"
              onClick={() => setFormModal((s) => ({ ...s, open: false }))}
              className="flex-1 px-4 py-3 rounded-xl border border-[#E8DCC8] bg-[#FAF7F2] text-[#9C5A22] text-sm font-bold hover:bg-[#E8DCC8] hover:text-[#5C3010] transition-all disabled:opacity-50 shadow-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#7C4318] to-[#5C3010] text-white text-sm font-bold hover:from-[#5C3010] hover:to-[#4A260D] transition-all disabled:opacity-70 shadow-md shadow-[#7C4318]/20"
            >
              {isSubmitting ? <Spinner size={16} className="text-white" /> : null}
              Simpan Kategori
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Deletion Confirm Dialog ── */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, category: null, isLoading: false })}
        onConfirm={handleDelete}
        title="Hapus Kategori"
        message={`Apakah Anda yakin ingin menghapus kategori "${deleteDialog.category?.name}"?`}
        isLoading={deleteDialog.isLoading}
      />

      {/* ── Toast Notifications ── */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
