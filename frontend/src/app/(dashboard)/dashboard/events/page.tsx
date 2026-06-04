'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  CalendarDays,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Clock,
  Trophy,
  ChevronRight,
  Calendar,
  XCircle,
  Play,
  CheckCircle2,
  HelpCircle,
  ClipboardCheck,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import Spinner from '@/components/ui/Spinner';
import StatCard from '@/components/ui/StatCard';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import EventFormModal from '@/components/events/EventFormModal';
import {
  listEventsApi,
  createEventApi,
  updateEventApi,
  deleteEventApi,
} from '@/services/event.service';
import {
  listUpcomingEventsApi,
  listMyExamsApi,
  enrollApi,
} from '@/services/exam.service';
import type { UpcomingEvent, UserApproval } from '@/services/exam.service';
import type {
  Event,
  CreateEventRequest,
  PaginationMeta,
  ApiErrorResponse,
} from '@/types/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
}
function fmtDuration(minutes: number) {
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
}

function fmtDurationFull(minutes: number) {
  if (minutes <= 0) return '0 menit';
  if (minutes < 60) return `${minutes} menit`;
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  
  let res = [];
  if (d > 0) res.push(`${d} hari`);
  if (h > 0) res.push(`${h} jam`);
  if (m > 0) res.push(`${m} menit`);
  return res.join(' ');
}

function fmtDateRange(startIso: string, endIso: string) {
  const d1 = fmtDate(startIso);
  const d2 = fmtDate(endIso);
  const t1 = fmtTime(startIso);
  const t2 = fmtTime(endIso);
  if (d1 === d2) {
    return `${d1} • ${t1} - ${t2}`;
  }
  return `${d1} ${t1} - ${d2} ${t2}`;
}

function getEventStatus(event: Event): {
  label: string;
  color: string;
  dot: string;
} {
  const now = Date.now();
  const start = new Date(event.start_time).getTime();
  const end = new Date(event.end_time).getTime();
  if (now < start) return { label: 'Akan Datang', color: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500' };
  if (now >= start && now <= end) return { label: 'Berlangsung', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' };
  return { label: 'Selesai', color: 'text-gray-500 bg-gray-100 border-gray-200', dot: 'bg-gray-400' };
}

// ─── Live Countdown Hook ──────────────────────────────────────────────────────
function useCountdown(endTimeISO: string, startTimeISO: string) {
  const [minutesLeft, setMinutesLeft] = useState<number>(0);
  const [status, setStatus] = useState<'upcoming' | 'ongoing' | 'finished'>('upcoming');

  useEffect(() => {
    const calculate = () => {
      const now = Date.now();
      const start = new Date(startTimeISO).getTime();
      const end = new Date(endTimeISO).getTime();

      if (now < start) {
        setStatus('upcoming');
        const diffMins = Math.floor((start - now) / 60000);
        setMinutesLeft(diffMins);
      } else if (now >= start && now <= end) {
        setStatus('ongoing');
        const diffMins = Math.floor((end - now) / 60000);
        setMinutesLeft(diffMins);
      } else {
        setStatus('finished');
        setMinutesLeft(0);
      }
    };

    calculate();
    const timer = setInterval(calculate, 60000); // Update every minute
    return () => clearInterval(timer);
  }, [endTimeISO, startTimeISO]);

  return { minutesLeft, status };
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({
  event,
  index,
  onEdit,
  onDelete,
}: {
  event: Event;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = getEventStatus(event);
  const countdown = useCountdown(event.end_time, event.start_time);
  const isEventFinished = countdown.status === 'finished';

  let countdownText = '';
  let countdownColor = 'text-gray-500';
  if (countdown.status === 'upcoming') {
    countdownText = `Dimulai dalam ${fmtDurationFull(countdown.minutesLeft)}`;
    countdownColor = 'text-blue-600';
  } else if (countdown.status === 'ongoing') {
    countdownText = `${fmtDurationFull(countdown.minutesLeft)} akan berakhir`;
    countdownColor = 'text-emerald-600 font-medium';
  } else {
    countdownText = '0 menit (Selesai)';
    countdownColor = 'text-gray-400';
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8DCC8] shadow-md hover:shadow-2xl hover:border-[#D4924A] hover:-translate-y-1.5 transition-all duration-300 group overflow-hidden flex flex-col h-full relative">
      {/* Decorative gradient background (subtle) */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#D4924A]/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      {/* Top accent */}
      <div className="h-1.5 bg-gradient-to-r from-[#D4924A] to-[#5C3010]" />

      <div className="p-5 relative z-10 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            {/* Status badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              {/* Countdown Live Info */}
              <span className={`text-[11px] ${countdownColor}`}>
                {countdownText}
              </span>
            </div>
            <h3 className="text-[#5C3010] font-black text-lg tracking-tight leading-snug mt-1">{event.name}</h3>
          </div>
          {/* Action buttons */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={onEdit}
              className="p-2 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition-all"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
              title="Hapus"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2.5 text-[13px] text-[#7A4520] font-medium mt-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#FAF7F2] text-[#D4924A] border border-[#E8DCC8]">
              <Calendar size={14} className="flex-shrink-0" />
            </div>
            <span>{fmtDateRange(event.start_time, event.end_time)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-1.5 ${isEventFinished ? 'opacity-70' : ''}`}>
              <Clock size={14} className={isEventFinished ? 'text-gray-400' : 'text-[#D4924A]'} />
              <span className={isEventFinished ? 'text-gray-500' : ''}>{fmtDuration(event.duration_minutes)}</span>
            </span>
            <span className={`flex items-center gap-1.5 ${isEventFinished ? 'opacity-70' : ''}`} title="Total Soal Didaftarkan">
              <HelpCircle size={14} className={isEventFinished ? 'text-gray-400' : 'text-[#D4924A]'} />
              <strong className={isEventFinished ? 'text-gray-500' : 'text-[#5C3010] font-bold'}>{event.total_questions || 0}</strong> <span className={isEventFinished ? 'text-gray-500' : ''}>soal</span>
            </span>
            <span className={`flex items-center gap-1.5 ${isEventFinished ? 'opacity-70' : ''}`}>
              <Trophy size={14} className={isEventFinished ? 'text-gray-400' : 'text-emerald-500'} />
              <span className={isEventFinished ? 'text-gray-500' : ''}>Batas Lulus <strong className={isEventFinished ? 'text-gray-500' : 'text-[#5C3010] font-bold'}>{event.passing_grade}%</strong></span>
            </span>
          </div>
        </div>

        {/* Detail button */}
        <div className="mt-auto pt-6">
          <Link
            href={`/dashboard/events/${event.id}`}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all duration-300 shadow-sm hover:shadow-lg ${
              countdown.status === 'ongoing'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 border-transparent text-white hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/30 hover:shadow-emerald-500/40'
                : 'bg-gradient-to-r from-[#FAF7F2] to-white border-[#E8DCC8] text-[#9C5A22] hover:border-[#D4924A] hover:bg-gradient-to-r hover:from-[#9C5A22] hover:to-[#5C3010] hover:text-white'
            }`}
          >
            Kelola Soal & Peserta
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Content ─────────────────────────────────────────────────────────────
function AdminEventsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [formModal, setFormModal] = useState<{
    open: boolean; mode: 'create' | 'edit'; event: Event | null;
  }>({ open: false, mode: 'create', event: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean; event: Event | null; isLoading: boolean;
  }>({ open: false, event: null, isLoading: false });

  const [formApiError, setFormApiError] = useState<string | null>(null);
  const { toasts, toast, dismiss } = useToast();

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listEventsApi(page, 9, search);
      setEvents(res.data);
      setMeta(res.meta);
    } catch {
      toast('error', 'Gagal memuat data jadwal ujian.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Handle "new=true" from Quick Actions
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setFormModal({ open: true, mode: 'create', event: null });
      const params = new URLSearchParams(searchParams.toString());
      params.delete('new');
      router.replace(`/dashboard/events?${params.toString()}`);
    }
  }, [searchParams, router]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSearch(searchInput); }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Status counts ───────────────────────────────────────────────────────────
  const now = Date.now();
  const activeCount = events.filter((e) => {
    const s = new Date(e.start_time).getTime();
    const en = new Date(e.end_time).getTime();
    return now >= s && now <= en;
  }).length;
  const upcomingCount = events.filter((e) => now < new Date(e.start_time).getTime()).length;

  // ─── CRUD Handlers ───────────────────────────────────────────────────────────
  const handleCreate = async (data: CreateEventRequest) => {
    setFormApiError(null);
    try {
      await createEventApi(data);
      toast('success', 'Jadwal ujian baru berhasil dibuat.');
      setFormModal({ open: false, mode: 'create', event: null });
      fetchEvents();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as ApiErrorResponse)?.message ?? 'Gagal membuat jadwal ujian.'
        : 'Terjadi kesalahan.';
      setFormApiError(msg);
      throw err;
    }
  };

  const handleUpdate = async (data: CreateEventRequest) => {
    if (!formModal.event) return;
    setFormApiError(null);
    try {
      await updateEventApi(formModal.event.id, data);
      toast('success', 'Jadwal ujian berhasil diperbarui.');
      setFormModal({ open: false, mode: 'edit', event: null });
      fetchEvents();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as ApiErrorResponse)?.message ?? 'Gagal memperbarui jadwal.'
        : 'Terjadi kesalahan.';
      setFormApiError(msg);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.event) return;
    setDeleteDialog((d) => ({ ...d, isLoading: true }));
    try {
      await deleteEventApi(deleteDialog.event.id);
      toast('success', `Jadwal "${deleteDialog.event.name}" berhasil dihapus.`);
      setDeleteDialog({ open: false, event: null, isLoading: false });
      fetchEvents();
    } catch {
      toast('error', 'Gagal menghapus jadwal ujian.');
      setDeleteDialog((d) => ({ ...d, isLoading: false }));
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <CalendarDays size={18} className="text-amber-700" />
          </div>
          <p className="text-gray-500 text-sm">
            Buat dan kelola sesi ujian, soal, serta peserta
          </p>
        </div>
        <button
          id="btn-add-event"
          onClick={() => {
            setFormApiError(null);
            setFormModal({ open: true, mode: 'create', event: null });
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#7C4318] to-[#9C5A22] text-white text-sm font-semibold rounded-xl shadow-sm shadow-amber-900/20 hover:from-[#5C3010] hover:to-[#7C4318] transition-all"
        >
          <Plus size={16} />
          Buat Jadwal Ujian
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Jadwal"
          value={meta?.total_records ?? '—'}
          icon={<CalendarDays size={20} className="text-[#9C5A22]" />}
        />
        <StatCard
          title="Sedang Berlangsung"
          value={activeCount}
          icon={<Play size={20} className="text-emerald-600" />}
          color="bg-emerald-50 border-emerald-100"
        />
        <StatCard
          title="Akan Datang"
          value={upcomingCount}
          icon={<Clock size={20} className="text-blue-600" />}
          color="bg-blue-50 border-blue-100"
        />
      </div>

      {/* Toolbar */}
      <div className="flex gap-4 pt-4">
        <div className="flex-1 flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2.5 border border-[#E8DCC8] focus-within:ring-2 focus-within:ring-[#D4924A]/30 focus-within:border-[#D4924A] transition-all relative shadow-sm">
          <Search size={16} className="text-[#9C5A22] flex-shrink-0" />
          <input
            type="text"
            placeholder="Cari nama ujian..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 text-sm text-[#5C3010] font-medium placeholder:text-gray-400 outline-none bg-transparent pr-6"
            id="search-events"
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

      {/* Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <Spinner size={28} className="text-amber-600" />
          <span className="text-sm">Memuat jadwal ujian...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <CalendarDays size={40} className="text-gray-200" />
          <p className="text-sm font-medium text-gray-500">
            {search ? `Tidak ada ujian dengan kata kunci "${search}"` : 'Belum ada jadwal ujian'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event, idx) => (
            <EventCard
              key={event.id}
              event={event}
              index={(page - 1) * 9 + idx + 1}
              onEdit={() => {
                setFormApiError(null);
                setFormModal({ open: true, mode: 'edit', event });
              }}
              onDelete={() => setDeleteDialog({ open: true, event, isLoading: false })}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-xs">
            Menampilkan {(page - 1) * 9 + 1}–{Math.min(page * 9, meta.total_records)} dari{' '}
            {meta.total_records} jadwal
          </p>
          <Pagination page={page} totalPages={meta.total_pages} onPageChange={setPage} isLoading={isLoading} />
        </div>
      )}

      {/* Modals */}
      <EventFormModal
        isOpen={formModal.open}
        onClose={() => setFormModal((s) => ({ ...s, open: false }))}
        mode={formModal.mode}
        event={formModal.event}
        onSubmit={formModal.mode === 'create' ? handleCreate : handleUpdate}
        apiError={formApiError}
      />

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, event: null, isLoading: false })}
        onConfirm={handleDelete}
        title="Hapus Jadwal Ujian"
        message={`Hapus jadwal "${deleteDialog.event?.name}" beserta semua data soal dan pesertanya? Tindakan ini tidak dapat dibatalkan.`}
        isLoading={deleteDialog.isLoading}
      />

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

// ─── Peserta Content ──────────────────────────────────────────────────────────

function MyExamCard({ exam }: { exam: UserApproval }) {
  // Gunakan is_event_finished dari server (lebih akurat, tidak bergantung clock browser)
  // Fallback ke perhitungan client-side jika field belum ada (backward compat)
  const isEventFinished = exam.is_event_finished ?? (Date.now() > new Date(exam.end_time).getTime());
  const countdown = useCountdown(exam.end_time, exam.start_time);

  let countdownText = '';
  let countdownColor = 'text-gray-500';
  if (isEventFinished || exam.is_completed) {
    countdownText = '0 menit (Selesai)';
    countdownColor = 'text-gray-400';
  } else if (countdown.status === 'upcoming') {
    countdownText = `Dimulai dalam ${fmtDurationFull(countdown.minutesLeft)}`;
    countdownColor = 'text-blue-600';
  } else if (countdown.status === 'ongoing') {
    countdownText = `${fmtDurationFull(countdown.minutesLeft)} akan berakhir`;
    countdownColor = 'text-[#D97706] font-medium';
  } else {
    countdownText = '0 menit (Selesai)';
    countdownColor = 'text-gray-400';
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8DCC8] shadow-sm hover:shadow-xl hover:border-[#D4924A] hover:-translate-y-1.5 transition-all duration-300 group flex flex-col relative overflow-hidden">
      {/* Decorative top accent */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${
        exam.is_completed ? 'bg-gradient-to-r from-[#9C5A22] to-[#7C4318]' : 
        isEventFinished ? 'bg-gray-300' : 
        exam.status === 'approved' ? 'bg-gradient-to-r from-[#D4924A] via-[#9C5A22] to-[#5C3010]' : 
        exam.status === 'revoked' ? 'bg-red-400' : 
        'bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500'
      }`} />
      
      <div className="p-5 pt-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-4 gap-4">
          <h3 className="font-black text-[#5C3010] text-xl leading-tight line-clamp-2 group-hover:text-[#9C5A22] transition-colors">{exam.name}</h3>
          <span className={`flex-shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-widest shadow-sm ${
            exam.is_completed ? 'bg-[#FAF7F2] text-[#7A4520] border-[#E8DCC8]' :
            isEventFinished ? 'bg-[#FAF7F2] text-gray-500 border-[#E8DCC8]' :
            exam.status === 'approved' ? 'bg-[#FAF7F2] text-[#9C5A22] border-[#E8DCC8]' :
            exam.status === 'revoked' ? 'bg-red-50 text-red-600 border-red-200' :
            'bg-amber-50 text-amber-600 border-amber-200'
          }`}>
            {exam.is_completed ? 'SELESAI' : isEventFinished ? 'WAKTU HABIS' : exam.status === 'approved' ? 'SIAP UJIAN' : exam.status}
          </span>
        </div>
        
        <div className="space-y-3 mb-6 flex-1">
          <div className="flex items-center gap-2 text-sm text-[#7A4520] font-medium">
            <Calendar size={15} className="text-[#9C5A22] flex-shrink-0" />
            <span>{fmtDateRange(exam.start_time, exam.end_time)}</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#7A4520] font-medium">
            <div className="flex items-center gap-1.5">
              <Clock size={15} className={countdownColor} />
              <span className={countdownColor}>{countdownText}</span>
            </div>
            
            <div className={`flex items-center gap-1.5 ${isEventFinished || exam.is_completed ? 'opacity-70' : ''}`}>
              <HelpCircle size={15} className={isEventFinished || exam.is_completed ? 'text-gray-400' : 'text-[#9C5A22]'} />
              <span className={`font-bold ${isEventFinished || exam.is_completed ? 'text-gray-400' : 'text-[#5C3010]'}`}>{exam.question_count || 0} soal</span>
            </div>

            <div className={`flex items-center gap-1.5 ${isEventFinished || exam.is_completed ? 'opacity-70' : ''}`}>
              <Trophy size={15} className={isEventFinished || exam.is_completed ? 'text-gray-400' : 'text-[#7A4520]'} />
              <span className={`font-bold ${isEventFinished || exam.is_completed ? 'text-gray-400' : 'text-[#5C3010]'}`}>
                Batas Lulus <span className={`font-black ${isEventFinished || exam.is_completed ? 'text-gray-500' : 'text-[#3B1F0A]'}`}>{exam.passing_grade || 0}%</span>
              </span>
            </div>
          </div>
        </div>
        
        {exam.is_completed ? (
          <div className="space-y-4 mt-2">
            <div className="relative overflow-hidden p-4 rounded-xl border bg-gradient-to-br from-[#FAF7F2] to-white border-[#E8DCC8] shadow-inner flex flex-col items-center justify-center">
              <Trophy size={60} className="absolute -right-4 -bottom-4 text-[#D4924A] opacity-10 pointer-events-none" />
              <span className={`text-[11px] font-extrabold uppercase tracking-widest mb-1 ${exam.is_passed ? 'text-emerald-600' : 'text-red-600'}`}>
                {exam.is_passed ? '★ Lulus Ujian ★' : 'Tidak Lulus'}
              </span>
              <span className="text-3xl font-black text-[#5C3010] tracking-tighter">
                {exam.score.toFixed(2)}
              </span>
            </div>
            <Link href={`/dashboard/exams/${exam.event_id}/result`} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#9C5A22] to-[#5C3010] text-white hover:shadow-lg shadow-md shadow-[#9C5A22]/30 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5">
              Lihat Hasil & Pembahasan
            </Link>
          </div>
        ) : isEventFinished ? (
          <button disabled className="w-full flex items-center justify-center gap-2 bg-[#FAF7F2] text-[#9C5A22] py-2.5 rounded-xl text-sm font-bold transition-colors border border-[#E8DCC8] shadow-sm opacity-70">
            <CheckCircle2 size={16} /> Ujian Berakhir
          </button>
        ) : exam.status === 'approved' ? (
          <Link href={`/dashboard/exams/${exam.event_id}`} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#D4924A] via-[#9C5A22] to-[#5C3010] shadow-md shadow-[#9C5A22]/30 text-white py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <Play size={16} fill="currentColor" /> Mulai Ujian
          </Link>
        ) : exam.status === 'pending' ? (
          <button disabled className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-50 to-[#FAF7F2] text-amber-600 border border-amber-200 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors">
            <Clock size={16} /> Menunggu Admin
          </button>
        ) : (
          <button disabled className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors">
            Dibatalkan
          </button>
        )}
      </div>
    </div>
  );
}


function UpcomingExamCard({ event, onEnroll, enrolling }: { event: Event, onEnroll: (id: string) => void, enrolling: string | null }) {
  const statusInfo = getEventStatus(event);
  const countdown = useCountdown(event.end_time, event.start_time);
  
  const isEventFinished = Date.now() > new Date(event.end_time).getTime();

  let countdownText = '';
  let countdownColor = 'text-gray-500';
  if (countdown.status === 'upcoming') {
    countdownText = `Dimulai dalam ${fmtDurationFull(countdown.minutesLeft)}`;
    countdownColor = 'text-[#7C4318]';
  } else if (countdown.status === 'ongoing') {
    countdownText = `${fmtDurationFull(countdown.minutesLeft)} akan berakhir`;
    countdownColor = 'text-[#D4924A] font-bold';
  } else {
    countdownText = '0 menit (Selesai)';
    countdownColor = 'text-gray-400';
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8DCC8] shadow-sm hover:shadow-xl hover:border-[#D4924A] hover:-translate-y-1.5 transition-all duration-300 flex flex-col group overflow-hidden relative">
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${statusInfo.label === 'BERLANGSUNG' ? 'bg-gradient-to-r from-[#D4924A] via-[#9C5A22] to-[#5C3010]' : 'bg-gray-300'}`} />
      <div className="p-5 pt-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-4 gap-4">
          <h3 className="font-black text-[#5C3010] text-xl leading-tight line-clamp-2 group-hover:text-[#9C5A22] transition-colors">{event.name}</h3>
          <span className={`flex-shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-widest shadow-sm ${
             statusInfo.label === 'BERLANGSUNG' ? 'bg-[#FAF7F2] text-[#9C5A22] border-[#E8DCC8]' : 'bg-gray-50 text-gray-500 border-gray-200'
          }`}>
            {statusInfo.label}
          </span>
        </div>
        <div className="space-y-3 mb-6 flex-1">
          <div className="flex items-center gap-2 text-sm text-[#7A4520] font-medium">
            <Calendar size={15} className="text-[#9C5A22] flex-shrink-0" />
            <span>{fmtDateRange(event.start_time, event.end_time)}</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#7A4520] font-medium">
            <div className="flex items-center gap-1.5">
              <Clock size={15} className="text-[#D4924A]" />
              <span>Durasi: {fmtDuration(event.duration_minutes)}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Clock size={15} className={countdownColor} />
              <span className={countdownColor}>{countdownText}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <HelpCircle size={15} className="text-[#9C5A22]" />
              <span className="font-bold text-[#5C3010]">{event.total_questions || 0} soal</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Trophy size={15} className="text-[#7A4520]" />
              <span className="font-bold text-[#5C3010]">
                Batas Lulus <span className="font-black text-[#3B1F0A]">{event.passing_grade || 0}%</span>
              </span>
            </div>
          </div>
        </div>
        {isEventFinished ? (
          <button disabled className="w-full flex items-center justify-center gap-2 bg-[#FAF7F2] text-[#9C5A22] py-2.5 rounded-xl text-sm font-bold transition-colors border border-[#E8DCC8] shadow-sm opacity-70">
            <CheckCircle2 size={16} /> Ujian Selesai
          </button>
        ) : (
          <button
            onClick={() => onEnroll(event.id)}
            disabled={enrolling === event.id}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#9C5A22] to-[#5C3010] text-white shadow-md shadow-[#9C5A22]/30 hover:shadow-lg hover:-translate-y-0.5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          >
            {enrolling === event.id ? <Spinner size={16} /> : <Plus size={16} />}
            Daftar Ujian
          </button>
        )}
      </div>
    </div>
  );
}

function PesertaEventsContent() {
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [myExams, setMyExams] = useState<UserApproval[]>([]);
  const [metaUpcoming, setMetaUpcoming] = useState<PaginationMeta | null>(null);
  const [metaMyExams, setMetaMyExams] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [pageUpcoming, setPageUpcoming] = useState(1);
  const [pageMyExams, setPageMyExams] = useState(1);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [upcomingRes, myExamsRes] = await Promise.all([
        listUpcomingEventsApi(pageUpcoming, 6),
        listMyExamsApi(pageMyExams, 6)
      ]);
      setUpcomingEvents(upcomingRes.data);
      setMetaUpcoming(upcomingRes.meta);
      setMyExams(myExamsRes.data);
      setMetaMyExams(myExamsRes.meta);
    } catch {
      toast('error', 'Gagal memuat jadwal ujian.');
    } finally {
      setIsLoading(false);
    }
  }, [pageUpcoming, pageMyExams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const handleEnroll = async (eventId: string) => {
    setEnrolling(eventId);
    try {
      await enrollApi(eventId);
      toast('success', 'Berhasil mendaftar! Menunggu persetujuan Admin.');
      await fetchAllData(); // Refresh list so it moves to "Ujian Saya"
    } catch (err: any) {
      toast('error', err?.response?.data?.message || 'Gagal mendaftar ke event ini.');
    } finally {
      setEnrolling(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Ujian Saya (My Exams) Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#FAF7F2] border border-[#E8DCC8] shadow-sm flex items-center justify-center flex-shrink-0">
            <Trophy size={18} className="text-[#7A4520]" />
          </div>
          <div>
            <h2 className="text-gray-900 font-bold text-lg">Ujian Saya</h2>
            <p className="text-gray-500 text-sm">Status ujian yang Anda daftar atau sedang berjalan.</p>
          </div>
        </div>

        {isLoading && myExams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
            <Spinner size={28} className="text-indigo-600" />
          </div>
        ) : myExams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400 bg-gradient-to-b from-white to-[#FAF7F2]/50 rounded-2xl border-2 border-dashed border-[#E8DCC8] shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[#FAF7F2] border border-[#E8DCC8] shadow-sm flex items-center justify-center">
              <ClipboardCheck size={32} className="text-[#D4924A]" />
            </div>
            <p className="text-sm font-bold text-[#7A4520]">Belum ada riwayat pendaftaran ujian.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myExams.map(exam => (
              <MyExamCard key={exam.approval_id} exam={exam} />
            ))}
          </div>
        )}
        
        {metaMyExams && metaMyExams.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <Pagination page={pageMyExams} totalPages={metaMyExams.total_pages} onPageChange={setPageMyExams} isLoading={isLoading} />
          </div>
        )}
      </section>

      {/* Divider */}
      <hr className="border-gray-100 border-t-2 border-dashed" />

      {/* Jadwal Ujian Tersedia (Upcoming Events) Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#FAF7F2] border border-[#E8DCC8] shadow-sm flex items-center justify-center flex-shrink-0">
            <CalendarDays size={18} className="text-[#7A4520]" />
          </div>
          <div>
            <h2 className="text-gray-900 font-bold text-lg">Jadwal Ujian Tersedia</h2>
            <p className="text-gray-500 text-sm">Daftar tryout dan ujian yang dapat Anda ikuti.</p>
          </div>
        </div>

        {isLoading && upcomingEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
            <Spinner size={28} className="text-blue-600" />
          </div>
        ) : upcomingEvents.filter(e => !myExams.some(m => m.event_id === e.id)).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400 bg-gradient-to-b from-white to-[#FAF7F2]/50 rounded-2xl border-2 border-dashed border-[#E8DCC8] shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[#FAF7F2] border border-[#E8DCC8] shadow-sm flex items-center justify-center">
              <CalendarDays size={32} className="text-[#D4924A]" />
            </div>
            <p className="text-sm font-bold text-[#7A4520]">Tidak ada jadwal ujian baru yang tersedia.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.filter(e => !myExams.some(m => m.event_id === e.id)).map(event => (
              <UpcomingExamCard 
                key={event.id} 
                event={event as any} 
                onEnroll={handleEnroll} 
                enrolling={enrolling} 
              />
            ))}
          </div>
        )}
        
        {metaUpcoming && metaUpcoming.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <Pagination page={pageUpcoming} totalPages={metaUpcoming.total_pages} onPageChange={setPageUpcoming} isLoading={isLoading} />
          </div>
        )}
      </section>
    </div>
  );
}

function EventsRouter() {
  const { user } = useAuth();
  if (user?.role === 'peserta') {
    return <PesertaEventsContent />;
  }
  return <AdminEventsContent />;
}

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Spinner size={32} className="text-amber-600" /></div>}>
      <EventsRouter />
    </Suspense>
  );
}
