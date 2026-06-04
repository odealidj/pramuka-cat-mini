'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Trophy,
  Eye,
  Download,
  CalendarDays,
  Filter,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Play,
  Trash2,
} from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import StatCard from '@/components/ui/StatCard';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import AnswerReviewDrawer from '@/components/results/AnswerReviewDrawer';
import { listEventsApi, exportEventParticipantsApi, listEventParticipantsApi, removeEventParticipantApi } from '@/services/event.service';
import type { Event, EventParticipant, PaginationMeta } from '@/types/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDateTimeRange(startIso: string, endIso: string) {
  const ds = new Date(startIso);
  const de = new Date(endIso);
  const dateStr = ds.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const tStart = ds.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  const tEnd = de.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  return `${dateStr} ${tStart} - ${tEnd}`;
}
function fmtDuration(minutes: number) {
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
}

type StatusFilter = 'all' | 'completed' | 'passed' | 'failed' | 'pending';

// ─── Stat pill ────────────────────────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl border ${color}`}>
      <span className="text-xs opacity-70 font-medium">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}

// ─── Participant row ──────────────────────────────────────────────────────────
function ParticipantRow({
  participant,
  globalRank,
  passingGrade,
  onReview,
  onDelete,
}: {
  participant: EventParticipant;
  globalRank: number | null;
  passingGrade: number;
  onReview: () => void;
  onDelete: () => void;
}) {
  const isPending  = participant.status.toLowerCase() === 'pending';
  const isCompleted = participant.is_completed;

  return (
    <tr className="table-row-premium group">
      {/* Rank */}
      <td className="table-cell-premium text-center w-12">
        {isCompleted && globalRank !== null ? (
          <span
            className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
              globalRank === 1
                ? 'bg-gradient-to-br from-[#D4924A] to-[#7C4318] text-white border border-[#9C5A22]'
                : globalRank === 2
                ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white border border-gray-400'
                : globalRank === 3
                ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white border border-amber-700'
                : 'bg-[#FAF7F2] text-[#9C5A22] border border-[#E8DCC8]'
            }`}
          >
            {globalRank}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Peserta */}
      <td className="table-cell-premium">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{participant.full_name}</p>
          <p className="text-gray-400 text-xs font-mono">@{participant.username}</p>
        </div>
      </td>

      {/* Status */}
      <td className="table-cell-premium">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${
            participant.status.toLowerCase() === 'approved'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100'
              : participant.status.toLowerCase() === 'pending'
              ? 'bg-[#FAF7F2] text-[#9C5A22] border-[#E8DCC8] shadow-sm shadow-[#E8DCC8]/50'
              : 'bg-gray-50 text-gray-500 border-gray-200'
          }`}
        >
          {participant.status}
        </span>
      </td>

      {/* Skor */}
      <td className="table-cell-premium text-center">
        {isCompleted ? (
          <span
            className={`text-base font-bold ${
              participant.is_passed ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            {participant.score.toFixed(1)}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">
            {isPending ? 'Pending' : 'Belum selesai'}
          </span>
        )}
      </td>

      {/* Hasil */}
      <td className="table-cell-premium text-center hidden sm:table-cell">
        {isCompleted ? (
          participant.is_passed ? (
            <span className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-semibold">
              <CheckCircle2 size={13} /> Lulus
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1 text-red-500 text-xs font-semibold">
              <XCircle size={13} /> Tidak Lulus
            </span>
          )
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Aksi */}
      <td className="table-cell-premium text-right">
        <div className="flex items-center justify-end gap-2 ml-auto w-fit">
          {isCompleted && (
            <button
              onClick={onReview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF7F2]/50 text-[#9C5A22] text-xs font-bold hover:bg-[#9C5A22] hover:text-white transition-all border border-[#E8DCC8] hover:border-[#9C5A22] shadow-sm"
            >
              <Eye size={12} />
              Review
            </button>
          )}
          <button
            onClick={onDelete}
            title="Hapus hasil ujian peserta"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            Hapus
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Event Accordion ──────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

function EventResultCard({
  event,
  onReviewParticipant,
}: {
  event: Event;
  onReviewParticipant: (participant: EventParticipant, event: Event) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Participants data
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [meta, setMeta]               = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading]     = useState(false);

  // Summary stats (fetched once, not re-fetched on filter/page change)
  const [summary, setSummary] = useState<{
    total: number; completed: number; passed: number; avgScore: number; passRate: number;
  } | null>(null);

  // Filters
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [exportingFormat, setExportingFormat] = useState<'excel' | 'pdf' | null>(null);

  // Deletion Dialog State
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    participant: EventParticipant | null;
    isLoading: boolean;
  }>({ open: false, participant: null, isLoading: false });

  const { toast } = useToast();

  const handleRemoveClick = (participant: EventParticipant) => {
    setDeleteDialog({
      open: true,
      participant,
      isLoading: false,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.participant) return;

    // Strict double confirmation: prompt asking to type "HAPUS"
    const confirmation = prompt(
      `Tindakan ini sangat kritis!\n\n` +
      `Ketik "HAPUS" (huruf besar semua) untuk menghapus secara permanen peserta "${deleteDialog.participant.full_name}" (@${deleteDialog.participant.username}) dari ujian ini.\n\n` +
      `Semua data jawaban, nilai, dan kelulusan akan dihapus selamanya dan TIDAK BISA DIBALIKKAN KEMBALI:`
    );

    if (confirmation !== 'HAPUS') {
      if (confirmation !== null) {
        toast('error', 'Konfirmasi gagal. Anda harus mengetik "HAPUS".');
      }
      return;
    }

    setDeleteDialog((d) => ({ ...d, isLoading: true }));
    try {
      await removeEventParticipantApi(event.id, deleteDialog.participant.approval_id);
      
      toast('success', `Peserta "${deleteDialog.participant.full_name}" berhasil dihapus dari ujian.`);
      setDeleteDialog({ open: false, participant: null, isLoading: false });
      
      // Refresh list
      fetchParticipants(page, search, statusFilter);
      setSummary(null); // Recalculate summary next time
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Gagal menghapus hasil ujian peserta.';
      toast('error', msg);
      setDeleteDialog((d) => ({ ...d, isLoading: false }));
    }
  };

  const handleExport = async (e: React.MouseEvent, format: 'excel' | 'pdf') => {
    e.stopPropagation();
    try {
      setExportingFormat(format);
      await exportEventParticipantsApi(event.id, format);
    } catch (err) {
      console.error('Export error', err);
      alert('Gagal mengekspor data peserta');
    } finally {
      setExportingFormat(null);
    }
  };

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSearch(val);
    }, 400);
  };

  // Rank map — only valid when not filtering (all pages shown by score)
  const rankMap = new Map<string, number>();
  if (statusFilter === 'all' || statusFilter === 'completed') {
    let r = (page - 1) * PAGE_SIZE;
    participants.forEach((p) => {
      if (p.is_completed) rankMap.set(p.user_id, ++r);
    });
  }

  const fetchParticipants = useCallback(async (p: number, s: string, sf: StatusFilter) => {
    setIsLoading(true);
    try {
      // Map statusFilter to backend search hint (backend supports free-text search)
      // We pass status as part of search if needed; backend filters by name/username
      const searchTerm = s;
      const res = await listEventParticipantsApi(event.id, p, PAGE_SIZE, searchTerm);

      // Client-side status filter (backend doesn't have status filter param yet)
      let filtered = res.data;
      if (sf === 'completed') filtered = filtered.filter(x => x.is_completed);
      else if (sf === 'passed')    filtered = filtered.filter(x => x.is_completed && x.is_passed);
      else if (sf === 'failed')    filtered = filtered.filter(x => x.is_completed && !x.is_passed);
      else if (sf === 'pending')   filtered = filtered.filter(x => !x.is_completed);

      setParticipants(filtered);
      setMeta(res.meta);

      // Build summary once on first load (page 1, no filter)
      if (p === 1 && !s && sf === 'all' && !summary) {
        const all = res.data;
        const completed = all.filter(x => x.is_completed);
        const passed    = completed.filter(x => x.is_passed);
        const avg       = completed.length > 0
          ? completed.reduce((acc, x) => acc + x.score, 0) / completed.length
          : 0;
        setSummary({
          total: res.meta.total_records,
          completed: completed.length,
          passed: passed.length,
          avgScore: avg,
          passRate: completed.length > 0 ? (passed.length / completed.length) * 100 : 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  useEffect(() => {
    if (isExpanded) fetchParticipants(page, search, statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, page, search, statusFilter]);

  const toggle = () => setIsExpanded(v => !v);

  const statusOptions: { value: StatusFilter; label: string; color: string }[] = [
    { value: 'all',       label: 'Semua',        color: 'text-gray-600' },
    { value: 'completed', label: 'Selesai',       color: 'text-blue-600' },
    { value: 'passed',    label: 'Lulus',         color: 'text-emerald-600' },
    { value: 'failed',    label: 'Tidak Lulus',   color: 'text-red-500' },
    { value: 'pending',   label: 'Belum Selesai', color: 'text-amber-600' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E8DCC8] shadow-sm hover:shadow-md hover:border-[#D4924A] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">

      {/* ── Card Header ── */}
      <div
        onClick={toggle}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-[#FAF7F2]/50 transition-all cursor-pointer select-none group/header"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(); }}
      >
        <div className="w-1.5 h-12 rounded-full bg-gradient-to-b from-[#E8DCC8] via-[#D4924A] to-[#7C4318] flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <h3 className="text-gray-900 font-bold text-sm truncate">{event.name}</h3>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <CalendarDays size={11} /> {fmtDateTimeRange(event.start_time, event.end_time)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} /> {fmtDuration(event.duration_minutes)}
            </span>
            <span className="flex items-center gap-1">
              <ClipboardList size={11} className="text-amber-500" /> {event.total_questions || 0} soal
            </span>
            <span className="flex items-center gap-1">
              <Trophy size={11} className="text-emerald-500" /> Batas Lulus {event.passing_grade}%
            </span>
          </div>
        </div>

        {/* Quick stats (shown once fetched) */}
        {summary && (
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <Stat label="Peserta"   value={summary.total}                                    color="border-gray-100 text-gray-700" />
            <Stat label="Selesai"   value={summary.completed}                                color="border-blue-100 text-blue-700" />
            <Stat label="Lulus"     value={summary.passed}                                   color="border-emerald-100 text-emerald-700" />
            <Stat label="Rata-rata" value={summary.completed ? summary.avgScore.toFixed(1) : '—'} color="border-amber-100 text-amber-700" />
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => handleExport(e, 'excel')}
            disabled={!!exportingFormat}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F2]/50 border border-[#E8DCC8] rounded-full text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {exportingFormat === 'excel' ? <Spinner size={12} /> : <FileSpreadsheet size={14} className="text-emerald-600 transition-colors" />} Excel
          </button>
          <button
            onClick={(e) => handleExport(e, 'pdf')}
            disabled={!!exportingFormat}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F2]/50 border border-[#E8DCC8] rounded-full text-xs font-bold text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {exportingFormat === 'pdf' ? <Spinner size={12} /> : <FileText size={14} className="text-red-600 transition-colors" />} PDF
          </button>
          {isExpanded ? <ChevronUp size={18} className="text-[#9C5A22]" /> : <ChevronDown size={18} className="text-gray-400 group-hover/header:text-[#9C5A22] transition-colors" />}
        </div>
      </div>

      {/* ── Expanded Content ── */}
      {isExpanded && (
        <div className="border-t border-gray-100">

          {/* Summary bar */}
          {summary && summary.completed > 0 && (
            <div className="px-5 py-3.5 bg-[#FAF7F2]/30 border-b border-[#E8DCC8] flex flex-wrap gap-5 text-sm">
              <span className="text-[#9C5A22]">
                Selesai: <strong className="text-[#5C3010] text-base">{summary.completed}</strong> <span className="opacity-60">/ {summary.total}</span>
              </span>
              <span className="text-[#9C5A22]">
                Kelulusan:{' '}
                <strong className={`text-base ${summary.passRate >= 70 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {summary.passRate.toFixed(1)}%
                </strong>
              </span>
              <span className="text-[#9C5A22]">
                Rata-rata: <strong className="text-[#D97706] text-base">{summary.avgScore.toFixed(1)}</strong>
              </span>
              <span className="text-[#9C5A22]">
                Batas Lulus: <strong className="text-[#5C3010] text-base">{event.passing_grade}%</strong>
              </span>
            </div>
          )}

          {/* Filter toolbar */}
          <div className="flex flex-col sm:flex-row gap-4 px-5 py-5 border-b border-[#E8DCC8] bg-white">
            {/* Search */}
            <div className="flex-1 flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-4 py-2.5 border border-[#E8DCC8] focus-within:ring-2 focus-within:ring-[#D4924A]/30 focus-within:border-[#D4924A] transition-all relative shadow-sm">
              <Search size={16} className="text-[#9C5A22] flex-shrink-0" />
              <input
                type="text"
                placeholder="Cari nama atau nomor peserta..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[#5C3010] font-medium placeholder:text-gray-400 outline-none pr-6"
              />
              {searchInput && (
                <button
                  onClick={() => { handleSearchChange(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Hapus pencarian"
                >
                  <XCircle size={16} />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2 flex-shrink-0 bg-[#FAF7F2] p-1.5 rounded-xl border border-[#E8DCC8] shadow-sm">
              <div className="flex gap-1 flex-wrap">
                {statusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setPage(1); setStatusFilter(opt.value); }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === opt.value
                        ? 'bg-gradient-to-r from-[#7C4318] to-[#5C3010] text-white shadow-md shadow-[#7C4318]/20'
                        : `hover:bg-[#E8DCC8] ${opt.color.replace('text-gray-600', 'text-[#9C5A22]')}`
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size={22} className="text-amber-600" />
            </div>
          ) : participants.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
              <Users size={28} className="text-gray-200" />
              <p className="text-sm">
                {search || statusFilter !== 'all'
                  ? 'Tidak ada peserta yang sesuai filter.'
                  : 'Belum ada peserta untuk ujian ini.'}
              </p>
              {(search || statusFilter !== 'all') && (
                <button
                  onClick={() => { setSearchInput(''); setSearch(''); setStatusFilter('all'); setPage(1); }}
                  className="text-xs text-amber-600 hover:text-amber-800 font-medium mt-1"
                >
                  Hapus semua filter
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header-premium">
                      <th className="table-header-cell-premium text-center w-12">Rank</th>
                      <th className="table-header-cell-premium">Peserta</th>
                      <th className="table-header-cell-premium">Status</th>
                      <th className="table-header-cell-premium text-center">Skor</th>
                      <th className="table-header-cell-premium text-center hidden sm:table-cell">Hasil</th>
                      <th className="table-header-cell-premium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {participants.map((p, idx) => {
                      const rank = p.is_completed
                        ? (statusFilter === 'all' || statusFilter === 'completed' || statusFilter === 'passed' || statusFilter === 'failed')
                          ? rankMap.get(p.user_id) ?? null
                          : null
                        : null;
                      return (
                        <ParticipantRow
                          key={p.user_id}
                          participant={p}
                          globalRank={rank}
                          passingGrade={event.passing_grade}
                          onReview={() => onReviewParticipant(p, event)}
                          onDelete={() => handleRemoveClick(p)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              {meta && meta.total_records > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50/40">
                  <p className="text-gray-400 text-xs">
                    Menampilkan {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, meta.total_records)} dari{' '}
                    {meta.total_records} peserta
                    {(search || statusFilter !== 'all') ? ' (terfilter)' : ''}
                  </p>
                  <Pagination
                    page={page}
                    totalPages={meta.total_pages}
                    onPageChange={setPage}
                    isLoading={isLoading}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Deletion Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, participant: null, isLoading: false })}
        onConfirm={handleDeleteConfirm}
        title="Hapus Hasil Ujian"
        message={`Apakah Anda yakin ingin menghapus peserta "${deleteDialog.participant?.full_name}" (@${deleteDialog.participant?.username}) secara permanen? Seluruh jawaban dan hasil ujian peserta ini akan hilang selamanya dan tindakan ini TIDAK BISA DIBALIKKAN KEMBALI.`}
        isLoading={deleteDialog.isLoading}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const [events, setEvents]           = useState<Event[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Aggregate stats dari semua event yang telah di-load
  const totalEvents = events.length;

  const [reviewState, setReviewState] = useState<{
    participant: EventParticipant | null;
    event: Event | null;
  }>({ participant: null, event: null });

  const { toasts, toast, dismiss } = useToast();

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listEventsApi(1, 100, search);
      setEvents(res.data);
    } catch {
      toast('error', 'Gagal memuat data ujian.');
    } finally {
      setIsLoading(false);
    }
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={18} className="text-amber-700" />
          </div>
          <p className="text-gray-500 text-sm">
            Rekap nilai, rangking, dan review jawaban peserta per ujian
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Ujian"
          value={isLoading ? '—' : totalEvents}
          icon={<CalendarDays size={20} className="text-[#9C5A22]" />}
        />
        <StatCard
          title="Sedang Berlangsung"
          value={isLoading ? '—' : events.filter(e => {
            const now = new Date();
            return new Date(e.start_time) <= now && new Date(e.end_time) >= now;
          }).length}
          icon={<Play size={20} className="text-emerald-600" />}
          color="bg-emerald-50 border-emerald-100"
        />
        <StatCard
          title="Sudah Selesai"
          value={isLoading ? '—' : events.filter(e => new Date(e.end_time) < new Date()).length}
          icon={<CheckCircle2 size={20} className="text-blue-600" />}
          color="bg-blue-50 border-blue-100"
        />
      </div>

      {/* Search events */}
      <div className="flex gap-4 pt-4">
        <div className="flex-1 flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2.5 border border-[#E8DCC8] focus-within:ring-2 focus-within:ring-[#D4924A]/30 focus-within:border-[#D4924A] transition-all relative shadow-sm">
          <Search size={16} className="text-[#9C5A22] flex-shrink-0" />
          <input
            type="text"
            placeholder="Cari nama ujian..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 text-sm text-[#5C3010] font-medium placeholder:text-gray-400 outline-none bg-transparent pr-6"
            id="search-results"
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
          onClick={fetchEvents}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8DCC8] bg-white text-[#9C5A22] hover:bg-[#FAF7F2] hover:text-[#5C3010] text-sm font-bold shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Events accordion list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <Spinner size={28} className="text-amber-600" />
          <span className="text-sm">Memuat data ujian...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <BarChart3 size={40} className="text-gray-200" />
          <p className="text-sm font-medium text-gray-500">
            {search ? `Tidak ada ujian dengan kata kunci "${search}"` : 'Belum ada data ujian'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventResultCard
              key={event.id}
              event={event}
              onReviewParticipant={(participant, ev) =>
                setReviewState({ participant, event: ev })
              }
            />
          ))}
        </div>
      )}

      {/* Review Drawer */}
      <AnswerReviewDrawer
        participant={reviewState.participant}
        eventName={reviewState.event?.name ?? ''}
        passingGrade={reviewState.event?.passing_grade ?? 70}
        onClose={() => setReviewState({ participant: null, event: null })}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
