'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { startExamApi, listMyExamsApi, submitAnswerApi, finishExamApi, ParticipantQuestion, UserApproval } from '@/services/exam.service';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Clock, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function ExamPage() {
  const { id: eventId } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<ParticipantQuestion[]>([]);
  const [examInfo, setExamInfo] = useState<UserApproval | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  
  // State for answers mapping question_id -> option letter (A, B, C, D)
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  const [timeLeftStr, setTimeLeftStr] = useState<string>('--:--:--');
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);

  const fetchExamData = useCallback(async () => {
    try {
      // Fetch both myExams info (to get timer) and startExam (to get questions)
      const examsRes = await listMyExamsApi(1, 100);
      const currentExam = examsRes.data.find(e => e.event_id === eventId);
      
      if (!currentExam) {
        toast('error', 'Anda belum terdaftar atau disetujui pada ujian ini.');
        router.replace('/dashboard');
        return;
      }
      if (currentExam.is_completed) {
        toast('error', 'Anda sudah menyelesaikan ujian ini.');
        router.replace('/dashboard');
        return;
      }

      setExamInfo(currentExam);

      const qs = await startExamApi(eventId);
      setQuestions(qs);
      
    } catch (err: any) {
      toast('error', err?.response?.data?.message || 'Gagal memulai ujian.');
      router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  // Handle timer
  useEffect(() => {
    if (!examInfo || isTimeUp) return;

    let startedAt = examInfo.started_at ? new Date(examInfo.started_at).getTime() : Date.now();
    // if backend just created it and it's null in current fetch, default to now
    const durationMs = examInfo.duration_minutes * 60 * 1000;
    const endTime = startedAt + durationMs;

    const timer = setInterval(() => {
      const now = Date.now();
      const remain = endTime - now;
      
      if (remain <= 0) {
        setIsTimeUp(true);
        setTimeLeftStr('00:00:00');
        clearInterval(timer);
        handleAutoSubmit();
      } else {
        const h = Math.floor((remain / (1000 * 60 * 60)) % 24);
        const m = Math.floor((remain / 1000 / 60) % 60);
        const s = Math.floor((remain / 1000) % 60);
        setTimeLeftStr(
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [examInfo, isTimeUp]);

  const handleSelectAnswer = async (qId: string, opt: string) => {
    if (isTimeUp || submitting) return;
    
    // Optimistic update
    setAnswers(prev => ({ ...prev, [qId]: opt }));
    
    // Background sync
    try {
      await submitAnswerApi(eventId, { question_id: qId, selected_answer: opt });
    } catch {
      toast('error', 'Gagal menyimpan jawaban (Koneksi terputus).');
      // Bisa ditambahkan mekanisme queue retry di sini untuk production
    }
  };

  const finishExam = async () => {
    setSubmitting(true);
    try {
      const res = await finishExamApi(eventId);
      toast('success', `Ujian selesai! Skor Anda: ${res.score} (${res.is_passed ? 'LULUS' : 'TIDAK LULUS'})`);
      router.replace('/dashboard');
    } catch {
      toast('error', 'Gagal menyelesaikan ujian. Silakan coba lagi.');
      setSubmitting(false);
      setConfirmFinishOpen(false);
    }
  };

  const handleAutoSubmit = () => {
    toast('error', 'Waktu ujian telah habis! Sistem mengirimkan jawaban otomatis.');
    finishExam();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Spinner size={32} className="text-blue-600" />
        <p className="text-gray-500 font-medium">Mempersiapkan soal ujian...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <AlertTriangle size={48} className="text-amber-500" />
        <h2 className="text-xl font-bold text-gray-800">Ujian Tidak Memiliki Soal</h2>
        <p className="text-gray-500 max-w-md">Silakan hubungi administrator, event ini belum memiliki bank soal yang valid.</p>
        <button onClick={() => router.replace('/dashboard')} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-medium">Kembali</button>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const isAnswered = (id: string) => answers[id] !== undefined;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col md:flex-row gap-6 p-4 max-w-7xl mx-auto">
      
      {/* Left side: Question Area */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
        {/* Header Question */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
              {currentIdx + 1}
            </span>
            <span className="text-gray-500 text-sm font-medium">dari {questions.length} Soal</span>
          </div>
          <div className="md:hidden flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
             <Clock size={16} className="text-amber-600" />
             <span className="text-amber-700 font-mono font-bold text-sm">{timeLeftStr}</span>
          </div>
        </div>

        {/* Content Question */}
        <div className="flex-1 overflow-auto p-6 lg:p-10">
          <p className="text-gray-900 text-lg leading-relaxed font-medium mb-8">
            {currentQ.question_text}
          </p>

          <div className="space-y-3">
            {['a', 'b', 'c', 'd'].map(optKey => {
              const optVal = currentQ[`option_${optKey}` as keyof ParticipantQuestion] as string;
              const isSelected = answers[currentQ.id] === optKey.toUpperCase();

              return (
                <button
                  key={optKey}
                  onClick={() => handleSelectAnswer(currentQ.id, optKey.toUpperCase())}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                      : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                    isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 text-transparent'
                  }`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-gray-700 mr-2">{optKey.toUpperCase()}.</span>
                    <span className={`${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{optVal}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between">
          <button
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(prev => prev - 1)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={18} /> Sebelumnya
          </button>
          
          <button
            disabled={currentIdx === questions.length - 1}
            onClick={() => setCurrentIdx(prev => prev + 1)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors disabled:opacity-30 font-medium"
          >
            Selanjutnya <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Right side: Navigation & Info */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        {/* Timer Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center hidden md:block">
          <p className="text-gray-500 text-sm mb-2 font-medium">Sisa Waktu</p>
          <div className="flex items-center justify-center gap-3 text-3xl font-mono font-bold text-amber-600">
            <Clock size={28} className="text-amber-500" />
            {timeLeftStr}
          </div>
        </div>

        {/* Questions Grid */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-800">Navigasi Soal</h3>
            <span className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">
              Dijawab: {answeredCount}/{questions.length}
            </span>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, i) => {
                const answered = isAnswered(q.id);
                const active = i === currentIdx;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(i)}
                    className={`
                      aspect-square rounded-xl font-bold text-sm transition-all flex items-center justify-center border-2
                      ${active ? 'ring-2 ring-blue-300 ring-offset-1' : ''}
                      ${answered 
                        ? 'bg-blue-500 text-white border-blue-500' 
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={() => setConfirmFinishOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-sm"
            >
              <CheckCircle size={18} />
              Selesaikan Ujian
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmFinishOpen}
        onClose={() => setConfirmFinishOpen(false)}
        onConfirm={finishExam}
        title="Akhiri Ujian?"
        message={`Anda telah menjawab ${answeredCount} dari ${questions.length} soal. Sisa waktu Anda ${timeLeftStr}. Apakah Anda yakin ingin menyelesaikan ujian sekarang? Jawaban tidak dapat diubah setelah ini.`}
        confirmLabel="Ya, Selesai"
        variant="success"
        isLoading={submitting}
      />
    </div>
  );
}
