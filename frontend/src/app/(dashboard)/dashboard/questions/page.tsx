"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Tag,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
  UploadCloud,
  Download,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { isAxiosError } from "axios";
import Spinner from "@/components/ui/Spinner";
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import StatCard from '@/components/ui/StatCard';
import { ToastContainer, useToast } from "@/components/ui/Toast";
import QuestionFormModal from "@/components/questions/QuestionFormModal";
import CategoryManagerModal from "@/components/questions/CategoryManagerModal";
import ImportExcelModal from "@/components/questions/ImportExcelModal";
import {
  listQuestionsApi,
  createQuestionApi,
  updateQuestionApi,
  deleteQuestionApi,
  exportQuestionsExcelApi,
  exportQuestionsPdfApi,
  exportQuestionTemplateApi,
} from "@/services/question.service";
import { listCategoriesApi } from "@/services/category.service";
import type {
  Question,
  Category,
  CreateQuestionRequest,
  PaginationMeta,
  ApiErrorResponse,
  CorrectAnswer,
} from "@/types/auth";

// ============================================================
// Helpers
// ============================================================
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const optionBadgeColor: Record<CorrectAnswer, string> = {
  A: "bg-blue-100 text-blue-700 border-blue-200",
  B: "bg-emerald-100 text-emerald-700 border-emerald-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
  D: "bg-rose-100 text-rose-700 border-rose-200",
};

// ============================================================
// Question Row — expandable for answer preview
// ============================================================
function QuestionRow({
  question,
  index,
  category,
  onEdit,
  onDelete,
}: {
  question: Question;
  index: number;
  category?: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const options: { key: CorrectAnswer; text: string }[] = [
    { key: "A", text: question.option_a },
    { key: "B", text: question.option_b },
    { key: "C", text: question.option_c },
    { key: "D", text: question.option_d },
  ];

  return (
    <>
      {/* Main row */}
      <tr className="table-row-premium group">
        <td className="px-5 py-4 text-gray-500 font-medium text-xs align-top">{index}</td>
        <td className="table-cell-premium">
          <div className="flex flex-col gap-1.5">
            <p className="text-gray-900 text-sm font-medium leading-snug line-clamp-2 group-hover:text-[#7C4318] transition-colors">
              {question.question_text}
            </p>
          </div>
        </td>
        <td className="table-cell-premium hidden md:table-cell">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-bold flex-shrink-0 shadow-sm ${
                optionBadgeColor[question.correct_answer]
              }`}
            >
              {question.correct_answer}
            </span>
            <span 
              className="text-sm text-gray-600 truncate max-w-[150px] lg:max-w-[200px]"
              title={options.find(o => o.key === question.correct_answer)?.text}
            >
              {options.find(o => o.key === question.correct_answer)?.text}
            </span>
          </div>
        </td>
        <td className="table-cell-premium hidden sm:table-cell">
          <span className="table-badge-premium">
            {question.weight}
          </span>
        </td>
        <td className="table-cell-premium">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-2 rounded-lg text-gray-400 hover:text-[#9C5A22] hover:bg-[#FAF7F2] transition-all"
              title={expanded ? "Tutup preview" : "Lihat pilihan jawaban"}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <button
              onClick={onEdit}
              className="p-2 rounded-lg text-gray-400 hover:text-[#9C5A22] hover:bg-[#FAF7F2] transition-all"
              title="Edit soal"
            >
              <Edit2 size={15} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
              title="Hapus soal"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expandable Answer Preview */}
      {expanded && (
        <tr className="bg-gray-50/80">
          <td />
          <td colSpan={4} className="px-5 pb-4 pt-2">
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Dibuat pada: 
              </span>
              <span className="text-xs text-gray-600 ml-1">
                {formatDate(question.created_at)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.map(({ key, text }) => {
                const isCorrect = key === question.correct_answer;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-sm ${
                      isCorrect
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isCorrect
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {key}
                    </span>
                    <span className="flex-1 leading-snug">{text}</span>
                    {isCorrect && (
                      <CheckCircle2
                        size={15}
                        className="text-emerald-500 flex-shrink-0"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================
// Main Page Content
// ============================================================
function QuestionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryIdFilter, setCategoryIdFilter] = useState<number | undefined>(undefined);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [justAddedQuestion, setJustAddedQuestion] = useState<Question | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formModal, setFormModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    question: Question | null;
  }>({ open: false, mode: "create", question: null });

  const [categoryModal, setCategoryModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    question: Question | null;
    isLoading: boolean;
  }>({ open: false, question: null, isLoading: false });

  const [formApiError, setFormApiError] = useState<string | null>(null);
  const { toasts, toast, dismiss } = useToast();

  // Category map for lookup in table
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  // Handle "new=true" from Quick Actions
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setFormModal({ open: true, mode: "create", question: null });
      // Clear the param without refreshing
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      router.replace(`/dashboard/questions?${params.toString()}`);
    }
  }, [searchParams, router]);

  // Handle category_id dari redirect halaman Kategori Soal
  useEffect(() => {
    const catId = searchParams.get("category_id");
    if (catId) {
      setPage(1);
      setCategoryIdFilter(Number(catId));
    }
  // Hanya jalankan sekali saat mount — intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Fetch
  // ============================================================
  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    setIsStale(false);
    // Reset stale timer
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    try {
      const res = await listQuestionsApi(page, 10, search, categoryIdFilter);
      setQuestions(res.data);
      setMeta(res.meta);
      const now = new Date();
      setLastFetchedAt(now);
      // Tandai data sebagai stale setelah 30 detik tanpa aktivitas
      staleTimerRef.current = setTimeout(() => setIsStale(true), 30_000);
    } catch {
      toast("error", "Gagal memuat data soal.");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, categoryIdFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bersihkan timer saat komponen unmount
  useEffect(() => () => { if (staleTimerRef.current) clearTimeout(staleTimerRef.current); }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await listCategoriesApi(1, 100);
      setCategories(res.data);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Clear justAddedQuestion when filters or pagination changes
  useEffect(() => {
    if (justAddedQuestion) {
      setJustAddedQuestion(null);
    }
  }, [searchInput, categoryIdFilter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // CRUD Handlers
  // ============================================================
  const handleCreate = async (data: CreateQuestionRequest) => {
    setFormApiError(null);
    try {
      const created = await createQuestionApi(data);
      toast("success", "Soal baru berhasil ditambahkan.");
      setFormModal({ open: false, mode: "create", question: null });

      // Simpan soal yang baru dibuat agar hanya ini yang ditampilkan
      setJustAddedQuestion(created);

      // Reload kategori juga (karena mungkin kategori "Umum" baru dibuat otomatis)
      fetchCategories();
    } catch (err) {
      const msg = isAxiosError(err)
        ? ((err.response?.data as ApiErrorResponse)?.message ??
          "Gagal menambahkan soal.")
        : "Terjadi kesalahan.";
      setFormApiError(msg);
      throw err;
    }
  };

  const handleUpdate = async (data: CreateQuestionRequest) => {
    if (!formModal.question) return;
    setFormApiError(null);
    try {
      await updateQuestionApi(formModal.question.id, data);
      toast("success", "Soal berhasil diperbarui.");
      setFormModal({ open: false, mode: "edit", question: null });
      if (justAddedQuestion && justAddedQuestion.id === formModal.question.id) {
        setJustAddedQuestion({
          ...justAddedQuestion,
          ...data,
        } as Question);
      }
      fetchQuestions();
    } catch (err) {
      const msg = isAxiosError(err)
        ? ((err.response?.data as ApiErrorResponse)?.message ??
          "Gagal memperbarui soal.")
        : "Terjadi kesalahan.";
      setFormApiError(msg);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.question) return;
    setDeleteDialog((d) => ({ ...d, isLoading: true }));
    try {
      await deleteQuestionApi(deleteDialog.question.id);
      toast("success", "Soal berhasil dihapus.");
      setDeleteDialog({ open: false, question: null, isLoading: false });
      if (justAddedQuestion && justAddedQuestion.id === deleteDialog.question.id) {
        setJustAddedQuestion(null);
      }
      fetchQuestions();
    } catch {
      toast("error", "Gagal menghapus soal.");
      setDeleteDialog((d) => ({ ...d, isLoading: false }));
    }
  };

  const handleExport = async (type: "excel" | "pdf") => {
    try {
      let blob: Blob;
      let filename: string;
      const catId = categoryIdFilter;
      
      if (type === "excel") {
        blob = await exportQuestionsExcelApi(search, catId);
        filename = "PramukaCAT - Bank Soal.xlsx";
      } else {
        blob = await exportQuestionsPdfApi(search, catId);
        filename = "PramukaCAT - Bank Soal.pdf";
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast("error", `Gagal mengekspor data ${type.toUpperCase()}.`);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await exportQuestionTemplateApi();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "PramukaCAT - Template Soal.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast("error", "Gagal mengunduh template.");
    }
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E8B478] to-[#9C5A22] flex items-center justify-center flex-shrink-0 shadow-sm border border-white/50">
            <BookOpen size={18} className="text-white" />
          </div>
          <p className="text-gray-500 text-sm">
            Kelola daftar soal ujian beserta kategorinya
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleExport('excel')}
            className="group flex items-center gap-2 px-4 py-2.5 bg-white text-gray-600 border border-[#E8DCC8] text-sm font-bold rounded-2xl hover:bg-[#FAF7F2] hover:text-[#9C5A22] hover:border-[#D4924A] hover:shadow-md transition-all"
            title="Export ke Excel"
          >
            <FileSpreadsheet size={16} className="text-emerald-600 group-hover:text-[#9C5A22] transition-colors" />
            <span className="hidden xl:inline">Excel</span>
          </button>
          
          <button
            onClick={() => handleExport('pdf')}
            className="group flex items-center gap-2 px-4 py-2.5 bg-white text-gray-600 border border-[#E8DCC8] text-sm font-bold rounded-2xl hover:bg-[#FAF7F2] hover:text-[#9C5A22] hover:border-[#D4924A] hover:shadow-md transition-all"
            title="Export ke PDF"
          >
            <FileText size={16} className="text-red-600 group-hover:text-[#9C5A22] transition-colors" />
            <span className="hidden xl:inline">PDF</span>
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="group flex items-center gap-2 px-4 py-2.5 bg-white text-gray-600 border border-[#E8DCC8] text-sm font-bold rounded-2xl hover:bg-[#FAF7F2] hover:text-[#9C5A22] hover:border-[#D4924A] hover:shadow-md transition-all"
            title="Download Template Excel"
          >
            <Download size={16} className="text-blue-600 group-hover:text-[#9C5A22] transition-colors" />
            <span className="hidden sm:inline">Template</span>
          </button>

          <button
            onClick={() => setImportModal(true)}
            className="group flex items-center gap-2 px-4 py-2.5 bg-white text-gray-600 border border-[#E8DCC8] text-sm font-bold rounded-2xl hover:bg-[#FAF7F2] hover:text-[#9C5A22] hover:border-[#D4924A] hover:shadow-md transition-all"
            title="Import dari Excel"
          >
            <UploadCloud size={16} className="text-indigo-600 group-hover:text-[#9C5A22] transition-colors" />
            <span className="hidden sm:inline">Import</span>
          </button>

          <button
            onClick={() => {
              setFormApiError(null);
              setFormModal({ open: true, mode: "create", question: null });
            }}
            id="btn-add-question"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#7C4318] to-[#9C5A22] text-white text-sm font-bold rounded-2xl shadow-sm shadow-amber-900/20 hover:from-[#5C3010] hover:to-[#7C4318] transition-all"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Tambah Soal</span>
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Soal"
          value={meta?.total_records ?? "—"}
          icon={<BookOpen size={20} className="text-[#9C5A22]" />}
        />
        <StatCard
          title="Kategori"
          value={categories.length}
          icon={<Tag size={20} className="text-[#9C5A22]" />}
        />
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            title="Halaman"
            value={meta ? `${page} / ${meta.total_pages}` : "—"}
            icon={<FileText size={20} className="text-[#9C5A22]" />}
          />
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white rounded-2xl border border-[#E8DCC8] shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 px-5 py-5 border-b border-[#E8DCC8] bg-white">
          <div className="flex-1 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2.5 border border-[#E8DCC8] focus-within:ring-2 focus-within:ring-[#D4924A]/30 focus-within:border-[#D4924A] transition-all relative shadow-sm">
              <Search size={16} className="text-[#9C5A22] flex-shrink-0" />
              <input
                type="text"
                placeholder="Cari teks soal..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[#5C3010] font-medium placeholder:text-gray-400 outline-none pr-6"
                id="search-questions"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Hapus filter"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
            
            <div className="w-full sm:w-48">
              <select
                value={categoryIdFilter === undefined ? "" : categoryIdFilter}
                onChange={(e) => {
                  setPage(1);
                  setCategoryIdFilter(e.target.value === "" ? undefined : Number(e.target.value));
                }}
                className="w-full bg-[#FAF7F2] rounded-xl px-3 py-2.5 border border-[#E8DCC8] text-sm text-[#5C3010] font-bold outline-none focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] transition-all appearance-none cursor-pointer shadow-sm"
              >
                <option value="">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stale / last-updated indicator + manual refresh */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setJustAddedQuestion(null);
                fetchQuestions();
              }}
              disabled={isLoading}
              title="Muat ulang dengan filter yang aktif"
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-bold shadow-sm transition-all disabled:opacity-50 ${
                isStale
                  ? "border-[#D4924A] text-white bg-gradient-to-r from-[#D4924A] to-[#9C5A22] hover:from-[#9C5A22] hover:to-[#7C4318] shadow-md shadow-[#9C5A22]/20"
                  : "border-[#E8DCC8] bg-white text-[#9C5A22] hover:bg-[#FAF7F2] hover:text-[#5C3010]"
              }`}
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">
                {isStale ? "Perbarui" : "Refresh"}
              </span>
            </button>
          </div>
        </div>

        {/* Banner kategori aktif dari redirect */}
        {categoryIdFilter !== undefined && searchParams.get('category_id') && (
          <div className="mx-5 mb-3 flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            {/* Kembali ke Kategori Soal */}
            <button
              onClick={() => router.push('/dashboard/categories')}
              className="flex items-center gap-1.5 text-amber-700 hover:text-amber-900 transition-colors font-semibold shrink-0"
              title="Kembali ke halaman Kategori Soal"
            >
              ← Kategori Soal
            </button>

            {/* Separator */}
            <span className="text-amber-300">/</span>

            {/* Label filter aktif */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Tag size={12} className="flex-shrink-0" />
              <span className="truncate">
                Menampilkan soal kategori: <strong>{searchParams.get('category_name') ?? 'Kategori terpilih'}</strong>
              </span>
            </div>

            {/* Hapus filter */}
            <button
              onClick={() => {
                setCategoryIdFilter(undefined);
                setPage(1);
                router.replace('/dashboard/questions');
              }}
              className="ml-auto flex items-center gap-1 text-amber-600 hover:text-amber-900 transition-colors shrink-0"
              title="Hapus filter — tampilkan semua soal"
            >
              <XCircle size={14} />
              <span className="hidden sm:inline">Hapus filter</span>
            </button>
          </div>
        )}

        {/* Newly Added Question Banner */}
        {justAddedQuestion && (
          <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <CheckCircle2 size={16} className="text-amber-600 flex-shrink-0" />
              <span>
                Menampilkan soal yang baru ditambahkan.
              </span>
            </div>
            <button
              onClick={() => setJustAddedQuestion(null)}
              className="text-xs text-amber-700 hover:text-amber-900 font-semibold underline underline-offset-2 flex items-center gap-1 transition-all"
            >
              Tampilkan Semua Soal
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header-premium">
                <th className="table-header-cell-premium w-10">
                  No
                </th>
                <th className="table-header-cell-premium">
                  Soal
                </th>
                <th className="table-header-cell-premium hidden md:table-cell">
                  Jawaban
                </th>
                <th className="table-header-cell-premium hidden sm:table-cell">
                  Bobot
                </th>
                <th className="table-header-cell-premium text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Spinner size={24} className="text-amber-600" />
                      <span className="text-sm">Memuat data soal...</span>
                    </div>
                  </td>
                </tr>
              ) : justAddedQuestion ? (
                <QuestionRow
                  key={justAddedQuestion.id}
                  question={justAddedQuestion}
                  index={1}
                  category={
                    justAddedQuestion.category_id != null
                      ? categoryMap[justAddedQuestion.category_id]
                      : undefined
                  }
                  onEdit={() => {
                    setFormApiError(null);
                    setFormModal({ open: true, mode: "edit", question: justAddedQuestion });
                  }}
                  onDelete={() =>
                    setDeleteDialog({
                      open: true,
                      question: justAddedQuestion,
                      isLoading: false,
                    })
                  }
                />
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <BookOpen size={36} className="text-gray-200" />
                      <p className="text-sm font-medium text-gray-500">
                        {search
                          ? `Tidak ada soal dengan kata kunci "${search}"`
                          : "Belum ada soal dalam bank soal"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                questions.map((q, idx) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    index={(page - 1) * 10 + idx + 1}
                    category={
                      q.category_id != null
                        ? categoryMap[q.category_id]
                        : undefined
                    }
                    onEdit={() => {
                      setFormApiError(null);
                      setFormModal({ open: true, mode: "edit", question: q });
                    }}
                    onDelete={() =>
                      setDeleteDialog({
                        open: true,
                        question: q,
                        isLoading: false,
                      })
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!justAddedQuestion && meta && meta.total_pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <p className="text-gray-400 text-xs">
              Menampilkan {(page - 1) * 10 + 1}–
              {Math.min(page * 10, meta.total_records)} dari{" "}
              {meta.total_records} soal
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

      {/* ── Modals ── */}
      <QuestionFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal((s) => ({ ...s, open: false }))}
        mode={formModal.mode}
        question={formModal.question}
        categories={categories}
        onSubmit={formModal.mode === "create" ? handleCreate : handleUpdate}
        apiError={formApiError}
      />

      <CategoryManagerModal
        isOpen={categoryModal}
        onClose={() => setCategoryModal(false)}
        onCategoriesChanged={fetchCategories}
      />

      <ImportExcelModal
        isOpen={importModal}
        onClose={() => setImportModal(false)}
        onSuccess={() => {
          fetchQuestions();
          fetchCategories();
          toast("success", "Soal berhasil di-import dari Excel.");
        }}
      />

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() =>
          setDeleteDialog({ open: false, question: null, isLoading: false })
        }
        onConfirm={handleDelete}
        title="Hapus Soal"
        message={`Hapus soal ini secara permanen? "${deleteDialog.question?.question_text.slice(0, 60)}..."`}
        isLoading={deleteDialog.isLoading}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Spinner size={32} className="text-amber-600" /></div>}>
      <QuestionsContent />
    </Suspense>
  );
}
