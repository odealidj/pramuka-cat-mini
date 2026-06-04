'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Users,
  Shuffle,
  Trash2,
  CheckCircle,
  Clock,
  Download,
  AlertCircle,
  Plus,
  XCircle,
  FileSpreadsheet,
  FileText,
  Trophy,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import {
  getEventApi,
  listEventQuestionsApi,
  addEventQuestionApi,
  addRandomEventQuestionsApi,
  removeEventQuestionApi,
  listEventParticipantsApi,
  approveParticipantApi,
  revokeParticipantApi,
  removeEventParticipantApi,
  exportEventParticipantsApi,
  exportEventQuestionsApi,
} from '@/services/event.service';
import { listQuestionsApi } from '@/services/question.service';
import { listCategoriesApi } from '@/services/category.service';
import type {
  Event,
  Question,
  EventParticipant,
  Category,
  PaginationMeta,
} from '@/types/auth';

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };
  const cls = map[status.toLowerCase()] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function getAnswerText(q: Question) {
  switch (q.correct_answer) {
    case 'A': return q.option_a;
    case 'B': return q.option_b;
    case 'C': return q.option_c;
    case 'D': return q.option_d;
    default: return '';
  }
}
type Tab = 'questions' | 'participants';

export default function EventManagerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: eventId } = use(params);

  const [event, setEvent] = useState<Event | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [tab, setTab] = useState<Tab>('questions');

  // ── Questions state ────────────────────────────────────────────────────────
  const [eventQuestions, setEventQuestions] = useState<Question[]>([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [eventQuestionSearch, setEventQuestionSearch] = useState('');
  const [exportingQFormat, setExportingQFormat] = useState<'excel' | 'pdf' | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Bank questions picker state
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [addingQId, setAddingQId] = useState<string | null>(null);

  // For random pull
  const [categories, setCategories] = useState<Category[]>([]);
  const [randomForm, setRandomForm] = useState({ category_id: '', amount: '5' });
  const [randomLoading, setRandomLoading] = useState(false);

  // ── Participants state ─────────────────────────────────────────────────────
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [pMeta, setPMeta] = useState<PaginationMeta | null>(null);
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [loadingP, setLoadingP] = useState(false);
  const [pPage, setPPage] = useState(1);
  const [pSearch, setPSearch] = useState('');
  const [pSearchInput, setPSearchInput] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'excel' | 'pdf' | null>(null);

  // ── Toast (Simulated via alert for now, can be replaced by real toast) ──
  const onToast = (type: 'success' | 'error', msg: string) => {
    alert(msg);
  };

  // ─── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchEvent = useCallback(async () => {
    setLoadingEvent(true);
    try {
      const data = await getEventApi(eventId);
      setEvent(data);
    } catch {
      alert('Gagal memuat detail ujian.');
      router.push('/dashboard/events');
    } finally {
      setLoadingEvent(false);
    }
  }, [eventId, router]);

  const fetchEventQuestions = useCallback(async () => {
    setLoadingQ(true);
    try {
      const res = await listEventQuestionsApi(eventId, 1, 500);
      setEventQuestions(res.data);
    } finally {
      setLoadingQ(false);
    }
  }, [eventId]);

  const fetchParticipants = useCallback(async (page: number = pPage) => {
    setLoadingP(true);
    try {
      const res = await listEventParticipantsApi(eventId, page, 10, pSearch);
      setParticipants(res.data);
      setPMeta(res.meta);
    } finally {
      setLoadingP(false);
    }
  }, [eventId, pPage, pSearch]);

  const fetchBankQuestions = useCallback(async () => {
    setPickerLoading(true);
    try {
      const res = await listQuestionsApi(1, 100, pickerSearch);
      const addedIds = new Set(eventQuestions.map((q) => q.id));
      setBankQuestions(res.data.filter((q) => !addedIds.has(q.id)));
    } finally {
      setPickerLoading(false);
    }
  }, [pickerSearch, eventQuestions]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await listCategoriesApi(1, 100);
      setCategories(res.data);
    } catch (err) {
      console.error('Gagal mengambil kategori:', err);
    }
  }, []);

  // Fetch hanya total peserta (untuk badge tab) saat halaman pertama kali dibuka
  const fetchParticipantCount = useCallback(async () => {
    try {
      const res = await listEventParticipantsApi(eventId, 1, 1);
      setParticipantCount(res.meta.total_records);
    } catch {
      // silent — badge tetap 0 jika gagal
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
    fetchEventQuestions();
    fetchCategories();
    fetchParticipantCount();
  }, [fetchEvent, fetchEventQuestions, fetchCategories, fetchParticipantCount]);

  useEffect(() => {
    if (tab === 'participants') {
      fetchParticipants();
    }
  }, [tab, fetchParticipants]);

  // Setelah data peserta berhasil di-fetch, sinkronkan count badge
  useEffect(() => {
    if (pMeta) setParticipantCount(pMeta.total_records);
  }, [pMeta]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPPage(1);
      setPSearch(pSearchInput);
    }, 500);
    return () => clearTimeout(t);
  }, [pSearchInput]);

  useEffect(() => {
    // Only fetch bank questions if on questions tab
    if (tab === 'questions') fetchBankQuestions();
  }, [tab, pickerSearch, fetchBankQuestions]);

  // ─── Question handlers ──────────────────────────────────────────────────────
  const handleAddQuestion = async (questionId: string) => {
    setAddingQId(questionId);
    try {
      await addEventQuestionApi(eventId, { question_id: questionId });
      // Remove locally from bank to give instant feel
      setBankQuestions(prev => prev.filter(q => q.id !== questionId));
      await fetchEventQuestions(); // refresh list
    } catch {
      onToast('error', 'Gagal menambahkan soal.');
    } finally {
      setAddingQId(null);
    }
  };

  const handleRemoveQuestion = async (questionId: string) => {
    try {
      await removeEventQuestionApi(eventId, questionId);
      await fetchEventQuestions();
    } catch {
      onToast('error', 'Gagal menghapus soal.');
    }
  };

  const handleRandomAdd = async () => {
    setRandomLoading(true);
    try {
      await addRandomEventQuestionsApi(eventId, {
        category_id: randomForm.category_id ? Number(randomForm.category_id) : null,
        amount: Number(randomForm.amount),
      });
      onToast('success', `${randomForm.amount} soal acak berhasil ditambahkan.`);
      await fetchEventQuestions();
    } catch {
      onToast('error', 'Gagal mengambil soal acak — jumlah soal mungkin kurang dari permintaan.');
    } finally {
      setRandomLoading(false);
    }
  };

  // ─── Participant handlers ────────────────────────────────────────────────────
  const handleApprove = async (approvalId: string) => {
    setApprovingId(approvalId);
    try {
      await approveParticipantApi(eventId, approvalId);
      onToast('success', 'Peserta disetujui. Notifikasi & Email sedang dikirim.');
      await fetchParticipants();
    } catch {
      onToast('error', 'Gagal menyetujui peserta.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRevoke = async (approvalId: string) => {
    try {
      setRevokingId(approvalId);
      await revokeParticipantApi(eventId, approvalId);
      onToast('success', 'Persetujuan peserta dibatalkan. Notifikasi & Email sedang dikirim.');
      fetchParticipants(1);
    } catch (err: any) {
      onToast('error', err?.response?.data?.message || 'Gagal membatalkan persetujuan');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRemoveParticipant = async (approvalId: string) => {
    const confirmation = prompt('Ketik "HAPUS" untuk menghapus peserta ini secara permanen dari ujian:');
    if (confirmation !== 'HAPUS') {
      if (confirmation !== null) {
        onToast('error', 'Konfirmasi gagal. Anda harus mengetik "HAPUS".');
      }
      return;
    }
    
    try {
      setRemovingParticipantId(approvalId);
      await removeEventParticipantApi(eventId, approvalId);
      onToast('success', 'Peserta dihapus. Notifikasi & Email sedang dikirim.');
      fetchParticipants(1);
    } catch (err: any) {
      onToast('error', err?.response?.data?.message || 'Gagal menghapus peserta');
    } finally {
      setRemovingParticipantId(null);
    }
  };

  // ─── Export ──────────────────────────────────────────────────────────────────
  const handleExportQuestions = async (format: 'excel' | 'pdf') => {
    try {
      setExportingQFormat(format);
      await exportEventQuestionsApi(eventId, format, showKey);
    } catch (err) {
      onToast('error', 'Gagal mengekspor soal.');
    } finally {
      setExportingQFormat(null);
    }
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      setExportingFormat(format);
      await exportEventParticipantsApi(eventId, format);
    } catch (err) {
      console.error('Failed to export', err);
      onToast('error', 'Gagal mengekspor data peserta.');
    } finally {
      setExportingFormat(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (loadingEvent) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} className="text-amber-600" />
      </div>
    );
  }

  if (!event) return null;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const filteredEventQuestions = eventQuestions.filter((q) =>
    q.question_text.toLowerCase().includes(eventQuestionSearch.toLowerCase())
  );

  const isFinished = Date.now() > new Date(event.end_time).getTime();

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-gray-50 -m-6 rounded-tl-xl overflow-hidden">
      {/* ─── Header ─── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 z-10 shadow-sm relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/events')}
                className="group flex items-center justify-center w-10 h-10 bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md hover:border-[#D4924A] transition-all flex-shrink-0 mr-1"
                title="Kembali ke Daftar Ujian"
              >
                <ArrowLeft size={20} className="text-gray-500 group-hover:text-[#9C5A22] transition-colors" />
              </button>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{event.name}</h1>
              {Date.now() > new Date(event.end_time).getTime() ? (
                <span className="inline-flex px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border-gray-200">
                  Selesai
                </span>
              ) : Date.now() >= new Date(event.start_time).getTime() ? (
                <span className="inline-flex px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border-emerald-200">
                  Sedang Berlangsung
                </span>
              ) : (
                <span className="inline-flex px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border-blue-200">
                  Akan Datang
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-lg">
                <Clock size={14} className="text-gray-400" />
                <span className="font-semibold">{fmtDate(event.start_time)}</span> <span className="text-gray-400">—</span> <span className="font-semibold">{fmtDate(event.end_time)}</span>
              </span>
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold ${isFinished ? 'bg-gray-100 text-gray-600 border border-gray-200' : 'bg-amber-50 text-amber-700 border border-transparent'}`}>
                ⏱ {event.duration_minutes} menit
              </span>
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold ${isFinished ? 'bg-gray-100 text-gray-600 border border-gray-200' : 'bg-emerald-50 text-emerald-700 border border-transparent'}`}>
                <Trophy size={14} /> Batas Lulus {event.passing_grade}%
              </span>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
            {([
              { key: 'questions', label: 'Kelola Soal', icon: BookOpen, count: eventQuestions.length },
              { key: 'participants', label: 'Peserta', icon: Users, count: participantCount ?? 0 },
            ] as const).map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-all ${
                  tab === key
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                <Icon size={16} />
                {label}
                <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                  tab === key ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Main Workspace ─── */}
      <div className={`flex-1 overflow-hidden flex flex-col relative transition-all duration-300 ${isFinished ? 'opacity-60 grayscale-[0.3]' : ''} bg-[#FAF7F2]/40`}>
        {/* Tab: Questions (Split Pane) */}
        <div className={`flex-1 flex overflow-hidden transition-all duration-300 ${tab === 'questions' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 hidden'}`}>
          {/* Left Pane: Current Questions */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Soal Ujian Ini
                  <span className="text-xs font-semibold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{eventQuestions.length}</span>
                </h2>
                
                <div className="relative w-72 flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2 border border-[#E8DCC8] focus-within:ring-2 focus-within:ring-[#D4924A]/30 focus-within:border-[#D4924A] transition-all shadow-sm">
                  <Search size={14} className="text-[#9C5A22] flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Cari soal yang ditambahkan..."
                    value={eventQuestionSearch}
                    onChange={(e) => setEventQuestionSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-[#5C3010] font-medium placeholder:text-gray-400 outline-none pr-6"
                  />
                  {eventQuestionSearch && (
                    <button
                      onClick={() => setEventQuestionSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>
              
              {/* EXPORT SECTION */}
              <div className="flex flex-col sm:flex-row items-center justify-between bg-white border border-gray-100 p-3 rounded-xl mb-4 shadow-sm gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${showKey ? 'bg-amber-500' : 'bg-gray-200'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showKey ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Sertakan Kunci Jawaban</span>
                  </label>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => handleExportQuestions('excel')}
                    disabled={!!exportingQFormat || eventQuestions.length === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8DCC8] rounded-full text-xs font-bold text-[#7C4318] hover:bg-[#FAF7F2] hover:border-[#D4924A] transition-all shadow-sm disabled:opacity-50 group"
                  >
                    {exportingQFormat === 'excel' ? <Spinner size={14} /> : <FileSpreadsheet size={14} className="text-emerald-600 group-hover:text-[#9C5A22] transition-colors" />} Excel
                  </button>
                  <button
                    onClick={() => handleExportQuestions('pdf')}
                    disabled={!!exportingQFormat || eventQuestions.length === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8DCC8] rounded-full text-xs font-bold text-[#7C4318] hover:bg-[#FAF7F2] hover:border-[#D4924A] transition-all shadow-sm disabled:opacity-50 group"
                  >
                    {exportingQFormat === 'pdf' ? <Spinner size={14} /> : <FileText size={14} className="text-red-600 group-hover:text-[#9C5A22] transition-colors" />} PDF
                  </button>
                </div>
              </div>
              
              {loadingQ ? (
                <div className="flex justify-center py-12"><Spinner size={28} className="text-amber-600" /></div>
              ) : eventQuestions.length === 0 ? (
                <div className="text-center py-20 bg-white border border-gray-200 rounded-3xl border-dashed">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={32} className="text-gray-300" />
                  </div>
                  <h3 className="text-gray-900 font-bold mb-1">Belum Ada Soal</h3>
                  <p className="text-sm text-gray-500">Pilih soal dari panel Bank Soal di sebelah kanan untuk menambahkannya ke ujian ini.</p>
                </div>
              ) : filteredEventQuestions.length === 0 && eventQuestionSearch ? (
                <div className="text-center py-20 bg-white border border-gray-200 rounded-3xl border-dashed">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={32} className="text-gray-300" />
                  </div>
                  <h3 className="text-gray-900 font-bold mb-1">Soal Tidak Ditemukan</h3>
                  <p className="text-sm text-gray-500">
                    Tidak ada soal yang cocok dengan kata kunci &quot;<span className="font-semibold text-gray-700">{eventQuestionSearch}</span>&quot;.
                  </p>
                  <button
                    onClick={() => setEventQuestionSearch('')}
                    className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all"
                  >
                    Hapus Filter Pencarian
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {filteredEventQuestions.map((q, i) => (
                    <li
                      key={q.id}
                      className="flex items-start gap-4 p-4 bg-white shadow-sm rounded-2xl border border-[#E8DCC8] group transition-all hover:shadow-md hover:border-[#D4924A] hover:bg-[#FAF7F2]/30"
                    >
                      <span className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#E8DCC8] text-[#9C5A22] text-sm font-black flex items-center justify-center flex-shrink-0 shadow-sm">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-800 text-sm font-medium leading-relaxed mb-2 group-hover:text-[#7C4318] transition-colors">{q.question_text}</p>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            Bobot: {q.weight || 1}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 line-clamp-1" title={getAnswerText(q)}>
                            Jawaban: {q.correct_answer || 'N/A'} - {getAnswerText(q)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveQuestion(q.id)}
                        disabled={isFinished}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border ${isFinished ? 'text-gray-400 opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : 'text-gray-400 font-semibold hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 border-transparent hover:border-red-200'}`}
                        title={isFinished ? "Ujian sudah selesai" : "Hapus dari ujian"}
                      >
                        <Trash2 size={14} /> Hapus
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Pane: Sticky Bank Picker */}
          {!isFinished && (
            <div className="w-[400px] flex-shrink-0 border-l border-[#E8DCC8] bg-white flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
            <div className="p-5 border-b border-[#E8DCC8] bg-gradient-to-br from-[#FAF7F2] to-white">
              <h3 className="font-bold text-[#7C4318] flex items-center gap-2 mb-4">
                <Search size={16} className="text-[#9C5A22]" /> Bank Soal
              </h3>
              
              {/* Random Pull Accordion */}
              <div className="bg-white border border-[#E8DCC8] rounded-xl p-4 mb-5 shadow-sm">
                <p className="text-xs text-[#9C5A22] font-bold mb-3 uppercase tracking-wider">Tarik Soal Acak</p>
                <div className="flex flex-col gap-3">
                  <select
                    value={randomForm.category_id}
                    onChange={(e) => setRandomForm((s) => ({ ...s, category_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8DCC8] text-sm bg-[#FAF7F2]/50 outline-none focus:ring-2 focus:ring-[#D4924A]/30 focus:bg-white transition-all font-medium"
                  >
                    <option value="">Semua Kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="Jumlah"
                      value={randomForm.amount}
                      onChange={(e) => setRandomForm((s) => ({ ...s, amount: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#E8DCC8] text-sm bg-[#FAF7F2]/50 outline-none focus:ring-2 focus:ring-[#D4924A]/30 focus:bg-white font-medium"
                    />
                    <button
                      onClick={handleRandomAdd}
                      disabled={randomLoading}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#9C5A22] text-white text-sm font-bold hover:bg-[#7A4520] transition-all disabled:opacity-50 flex-shrink-0 shadow-sm"
                    >
                      {randomLoading ? <Spinner size={14} className="text-white" /> : <Shuffle size={14} />} Tarik
                    </button>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2.5 border border-[#E8DCC8] focus-within:ring-2 focus-within:ring-[#D4924A]/30 focus-within:border-[#D4924A] transition-all relative shadow-sm">
                <Search size={16} className="text-[#9C5A22] flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Cari soal spesifik..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[#5C3010] font-medium placeholder:text-gray-400 outline-none pr-6"
                />
                {pickerSearch && (
                  <button
                    onClick={() => setPickerSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <XCircle size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 bg-white">
              {pickerLoading ? (
                <div className="flex justify-center py-8"><Spinner size={22} className="text-[#9C5A22]" /></div>
              ) : bankQuestions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">Tidak ada soal tersisa di Bank Soal.</p>
              ) : (
                <ul className="space-y-2">
                  {bankQuestions.map((q) => (
                    <li
                      key={q.id}
                      className="flex flex-col gap-3 p-3.5 bg-white rounded-xl border border-[#E8DCC8] hover:border-[#D4924A] hover:bg-[#FAF7F2]/30 hover:shadow-md transition-all group cursor-pointer"
                      onClick={() => handleAddQuestion(q.id)}
                    >
                      <p className="text-gray-700 text-sm leading-snug line-clamp-3 group-hover:text-[#7C4318]">
                        {q.question_text}
                      </p>
                      <button
                        disabled={addingQId === q.id}
                        className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#E8DCC8] text-[#9C5A22] text-xs font-bold group-hover:bg-[#9C5A22] group-hover:text-white transition-all disabled:opacity-50 shadow-sm"
                      >
                        {addingQId === q.id ? <Spinner size={12} /> : <Plus size={12} />} Tambah
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </div>
          )}
        </div>

        {/* Tab: Participants */}
        <div className={`flex-1 overflow-y-auto p-6 transition-all duration-300 ${tab === 'participants' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 hidden'}`}>
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div className="w-full sm:w-80 flex items-center gap-2 bg-[#FAF7F2] rounded-xl px-3 py-2.5 border border-[#E8DCC8] focus-within:ring-2 focus-within:ring-[#D4924A]/30 focus-within:border-[#D4924A] transition-all relative shadow-sm">
                <Search size={16} className="text-[#9C5A22] flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Cari nama atau nomor peserta..."
                  value={pSearchInput}
                  onChange={(e) => setPSearchInput(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[#5C3010] font-medium placeholder:text-gray-400 outline-none pr-6"
                />
                {pSearchInput && (
                  <button
                    onClick={() => setPSearchInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
              <div className="flex justify-end gap-3 flex-shrink-0">
                <button
                  onClick={() => handleExport('excel')}
                  disabled={!!exportingFormat}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E8DCC8] rounded-full text-sm font-bold text-[#7C4318] hover:bg-[#FAF7F2] hover:border-[#D4924A] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {exportingFormat === 'excel' ? <Spinner size={16} /> : <FileSpreadsheet size={16} className="text-emerald-600 group-hover:text-[#9C5A22] transition-colors" />} Export Excel
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={!!exportingFormat}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E8DCC8] rounded-full text-sm font-bold text-[#7C4318] hover:bg-[#FAF7F2] hover:border-[#D4924A] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {exportingFormat === 'pdf' ? <Spinner size={16} /> : <FileText size={16} className="text-red-600 group-hover:text-[#9C5A22] transition-colors" />} Export PDF
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              {loadingP ? (
                <div className="flex justify-center py-12"><Spinner size={28} className="text-amber-600" /></div>
              ) : participants.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users size={32} className="text-gray-300" />
                  </div>
                  <h3 className="text-gray-900 font-bold mb-1">Belum Ada Peserta</h3>
                  <p className="text-sm text-gray-500">Pendaftar ujian ini akan muncul di sini.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-header-premium">
                        <th className="table-header-cell-premium w-12">No</th>
                        <th className="table-header-cell-premium">Nomor Peserta</th>
                        <th className="table-header-cell-premium">Nama Peserta</th>
                        <th className="table-header-cell-premium">Status</th>
                        <th className="table-header-cell-premium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {participants.map((p, idx) => (
                        <tr key={p.user_id} className="table-row-premium">
                          <td className="table-cell-premium font-medium">{(pPage - 1) * 10 + idx + 1}</td>
                          <td className="table-cell-premium font-mono text-gray-500">{p.username}</td>
                          <td className="table-cell-premium font-bold text-gray-800">{p.full_name}</td>
                          <td className="table-cell-premium">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="table-cell-premium">
                            <div className="flex items-center justify-end gap-2">
                              {(p.status.toLowerCase() === 'pending' || p.status.toLowerCase() === 'revoked') && (
                                <button
                                  onClick={() => handleApprove(p.approval_id)}
                                  disabled={approvingId === p.approval_id || isFinished}
                                  title={isFinished ? "Ujian sudah selesai" : "Approve Peserta"}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {approvingId === p.approval_id ? <Spinner size={14} /> : <CheckCircle size={14} />} Approve
                                </button>
                              )}
                              
                              {p.status.toLowerCase() === 'approved' && (
                                <button
                                  onClick={() => handleRevoke(p.approval_id)}
                                  disabled={revokingId === p.approval_id || isFinished}
                                  title={isFinished ? "Ujian sudah selesai" : "Batalkan Peserta"}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {revokingId === p.approval_id ? <Spinner size={14} /> : <XCircle size={14} />} Revoke
                                </button>
                              )}

                              {(p.status.toLowerCase() === 'pending' || p.status.toLowerCase() === 'approved' || p.status.toLowerCase() === 'revoked') && (
                                <button
                                  onClick={() => handleRemoveParticipant(p.approval_id)}
                                  disabled={removingParticipantId === p.approval_id || isFinished}
                                  title={isFinished ? "Ujian sudah selesai" : "Hapus Peserta"}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {removingParticipantId === p.approval_id ? <Spinner size={14} /> : <Trash2 size={14} />} Hapus
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {pMeta && pMeta.total_pages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                  <p className="text-gray-400 text-xs">
                    Menampilkan {(pPage - 1) * 10 + 1}–{Math.min(pPage * 10, pMeta.total_records)} dari {pMeta.total_records} peserta
                  </p>
                  <Pagination page={pPage} totalPages={pMeta.total_pages} onPageChange={setPPage} isLoading={loadingP} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
