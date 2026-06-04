'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getExamResultParticipantApi } from '@/services/exam.service';
import type { UserAnswerDetail } from '@/types/auth';
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Download, Loader2, FileText } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { exportReviewAnswersParticipantApi } from '@/services/exam.service';

export default function ExamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();
  
  const [results, setResults] = useState<UserAnswerDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Hanya peserta yang boleh mengakses halaman ini
    if (user.role !== 'peserta') {
      router.replace('/dashboard');
      return;
    }

    const fetchResult = async () => {
      try {
        const data = await getExamResultParticipantApi(resolvedParams.id);
        setResults(data);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Gagal memuat hasil ujian.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [resolvedParams.id, user, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner size={40} className="text-indigo-600" />
        <p className="text-gray-500 font-medium">Memuat hasil ujian...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-500 mb-2">
          <XCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Oops!</h2>
        <p className="text-gray-500">{error}</p>
        <button
          onClick={() => router.push('/dashboard/events')}
          className="mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  // Calculate summary metrics
  const totalQuestions = results.length;
  let correctCount = 0;
  let totalWeight = 0;
  let achievedWeight = 0;

  results.forEach(item => {
    totalWeight += item.weight;
    if (item.is_correct) {
      correctCount++;
      achievedWeight += item.weight;
    }
  });

  const rawScore = totalWeight > 0 ? (achievedWeight / totalWeight) * 100 : 0;

  const handleExportPDF = async () => {
    if (!user) return;
    try {
      setIsExporting(true);
      await exportReviewAnswersParticipantApi(resolvedParams.id, {
        participant_name: user.full_name,
        event_name: "", // handled by backend
        score: rawScore, // handled by backend
        passing_grade: 0, // handled by backend
        is_passed: false // handled by backend
      });
    } catch (err) {
      console.error(err);
      alert('Gagal mengunduh PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-6 pb-20">
      {/* Header & Back Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/events')}
            className="group flex items-center justify-center w-10 h-10 bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md hover:border-[#D4924A] transition-all flex-shrink-0"
            title="Kembali ke Daftar Ujian"
          >
            <ArrowLeft size={20} className="text-gray-500 group-hover:text-[#9C5A22] transition-colors" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Hasil & Pembahasan</h1>
            <p className="text-gray-500 text-sm">Review kembali hasil pekerjaan ujian Anda</p>
          </div>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E8DCC8] text-[#5C3010] rounded-xl hover:bg-[#FAF7F2] hover:border-[#D4924A] hover:text-[#9C5A22] transition-all font-bold disabled:opacity-50 shadow-sm group"
        >
          {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} className="text-red-600 group-hover:text-[#9C5A22] transition-colors" />}
          Download PDF
        </button>
      </div>

      {/* Summary Score Card */}
      <div className="bg-gradient-to-br from-[#FAF7F2] to-white rounded-2xl border border-[#E8DCC8] shadow-sm p-8 overflow-hidden relative group hover:shadow-md hover:border-[#D4924A] transition-all duration-300">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-[#D4924A] group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500">
          <Trophy size={140} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 space-y-3 text-center md:text-left">
            <h2 className="text-[#D4924A] font-extrabold uppercase tracking-widest text-sm">Skor Akhir Anda</h2>
            <div className="text-6xl font-black text-[#5C3010] tracking-tighter drop-shadow-sm">
              {rawScore.toFixed(2)}
            </div>
            <div className="flex flex-wrap gap-3 mt-5 justify-center md:justify-start">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-bold text-emerald-800 shadow-sm">
                <CheckCircle2 size={18} className="text-emerald-600" />
                {correctCount} Benar
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-sm font-bold text-red-800 shadow-sm">
                <XCircle size={18} className="text-red-600" />
                {totalQuestions - correctCount} Salah
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Questions Review List */}
      <div className="space-y-4">
        <h3 className="font-black text-[#5C3010] text-xl px-1 border-b-2 border-[#E8DCC8] pb-3 inline-block mb-2">Pembahasan Soal</h3>
        
        {results.map((item, idx) => {
          const isUserCorrect = item.is_correct;
          const hasAnswered = item.selected_answer !== '';
          
          return (
            <div key={item.answer_id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md ${isUserCorrect ? 'border-emerald-200 hover:border-emerald-300' : 'border-red-200 hover:border-red-300'}`}>
              <div className={`px-6 py-4 flex justify-between items-center border-b ${isUserCorrect ? 'bg-gradient-to-r from-emerald-50 to-white border-emerald-100' : 'bg-gradient-to-r from-red-50 to-white border-red-100'}`}>
                <span className={`font-extrabold text-sm uppercase tracking-wider ${isUserCorrect ? 'text-emerald-800' : 'text-red-800'}`}>
                  Soal Nomor {idx + 1}
                </span>
                <div className={`flex items-center gap-2 text-sm font-bold px-3 py-1 rounded-lg bg-white shadow-sm border ${isUserCorrect ? 'text-emerald-700 border-emerald-100' : 'text-red-700 border-red-100'}`}>
                  {isUserCorrect ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-red-500" />}
                  {isUserCorrect ? 'Benar' : 'Salah'}
                  <div className="w-px h-4 bg-gray-200 mx-1"></div>
                  <span className="text-gray-500">Bobot:</span> <span className="text-[#5C3010]">{item.weight}</span>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <p className="text-[#5C3010] font-semibold text-base leading-relaxed whitespace-pre-wrap">
                  {item.question_text}
                </p>

                <div className="grid gap-3">
                  {['A', 'B', 'C', 'D'].map((opt) => {
                    const text = item[`option_${opt.toLowerCase()}` as keyof UserAnswerDetail];
                    if (!text) return null;

                    const isSelected = item.selected_answer === opt;
                    const isCorrectOption = item.correct_answer === opt;

                    // Determine option styling
                    let bgClass = 'bg-gray-50 border-gray-200';
                    let textClass = 'text-gray-700';
                    let icon = null;

                    if (isCorrectOption) {
                      bgClass = 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20';
                      textClass = 'text-emerald-950 font-bold';
                      icon = <CheckCircle2 size={20} className="text-emerald-600" />;
                    } else if (isSelected && !isCorrectOption) {
                      bgClass = 'bg-red-50 border-red-300';
                      textClass = 'text-red-950 font-medium';
                      icon = <XCircle size={20} className="text-red-500" />;
                    }

                    return (
                      <div key={opt} className={`relative flex items-center p-4 rounded-xl border ${bgClass} transition-all`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-lg mr-4 shadow-sm ${
                          isCorrectOption ? 'bg-emerald-500 text-white shadow-emerald-200' : 
                          isSelected ? 'bg-red-500 text-white shadow-red-200' : 
                          'bg-[#FAF7F2] text-[#9C5A22] border border-[#E8DCC8]'
                        }`}>
                          {opt}
                        </div>
                        <div className={`flex-1 ${textClass}`}>
                          {text}
                        </div>
                        {icon && (
                          <div className="flex-shrink-0 ml-4">
                            {icon}
                          </div>
                        )}
                        
                        {/* Selected Indicator Label */}
                        {isSelected && (
                          <div className="absolute -top-3 -right-2 px-3 py-1 bg-[#5C3010] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-full shadow-md border-2 border-white">
                            Jawaban Anda
                          </div>
                        )}
                        {isCorrectOption && !isSelected && (
                          <div className="absolute -top-3 -right-2 px-3 py-1 bg-emerald-500 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-full shadow-md border-2 border-white">
                            Kunci Jawaban
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {!hasAnswered && (
                  <div className="mt-4 p-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-medium flex items-center gap-2">
                    Anda tidak menjawab soal ini.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
