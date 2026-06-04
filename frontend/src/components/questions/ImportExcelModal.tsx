"use client";

import { useState, useRef } from "react";
import { X, UploadCloud, FileDown, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2, Search } from "lucide-react";
import { previewImportExcelApi, confirmImportExcelApi } from "@/services/question.service";
import type { ImportQuestionsPreviewResponse, ImportQuestionRow } from "@/types/auth";
import { isAxiosError } from "axios";
import Pagination from "@/components/ui/Pagination";

type Phase = "upload" | "preview";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportExcelModal({ isOpen, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ImportQuestionsPreviewResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setPhase("upload");
    setFile(null);
    setPreviewData(null);
    setApiError(null);
    setShowErrorsOnly(false);
    setSearchQuery("");
    setCurrentPage(1);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setApiError(null);
      setIsLoading(true);

      try {
        const data = await previewImportExcelApi(selectedFile);
        setPreviewData(data);
        setPhase("preview");
        setShowErrorsOnly(data.error_rows > 0);
        setSearchQuery("");
        setCurrentPage(1);
      } catch (err: any) {
        if (isAxiosError(err) && err.response?.status === 422) {
          // This means there are validation errors per row
          setPreviewData(err.response.data.data);
          setPhase("preview");
          setShowErrorsOnly(true);
          setSearchQuery("");
          setCurrentPage(1);
        } else {
          const msg = isAxiosError(err)
            ? err.response?.data?.message || "Gagal memproses file Excel"
            : "Terjadi kesalahan";
          setApiError(msg);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleConfirm = async () => {
    if (!previewData) return;
    setIsLoading(true);
    setApiError(null);
    try {
      await confirmImportExcelApi({ questions: previewData.data });
      onSuccess();
      handleClose();
    } catch (err: any) {
      const msg = isAxiosError(err)
        ? err.response?.data?.message || "Gagal menyimpan data import"
        : "Terjadi kesalahan";
      setApiError(msg);
      setIsLoading(false);
    }
  };

  // Derived state for pagination
  const filteredData = previewData ? previewData.data.filter(row => {
    if (showErrorsOnly && row.is_valid) return false;
    if (searchQuery && !row.question_text?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }) : [];
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" 
        onClick={!isLoading ? handleClose : undefined}
      />

      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E8DCC8] shadow-sm flex items-center justify-center">
              <FileSpreadsheet size={20} className="text-[#9C5A22]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Import Soal via Excel</h3>
              <p className="text-sm text-gray-500">Unggah file Excel untuk menambah banyak soal sekaligus.</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-xl transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {apiError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-start gap-3">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <p>{apiError}</p>
            </div>
          )}

          {phase === "upload" ? (
            <div className="space-y-6">


              {/* Upload Area */}
              <div 
                className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:bg-[#FAF7F2]/50 hover:border-[#D4924A] transition-colors cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 bg-[#FAF7F2] border border-[#E8DCC8] shadow-sm rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud size={32} className="text-[#D4924A]" />
                </div>
                <h4 className="text-gray-900 font-semibold mb-1">Pilih atau letakkan file Excel di sini</h4>
                <p className="text-gray-500 text-sm mb-6">Mendukung format .xlsx</p>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx"
                  onChange={handleFileChange}
                />
                
                <button
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#7C4318] to-[#9C5A22] text-white shadow-sm font-semibold rounded-xl hover:from-[#5C3010] hover:to-[#7C4318] disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Memproses File...</span>
                    </>
                  ) : (
                    "Pilih File Excel"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Preview Stats */}
              {previewData && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#E8DCC8] shadow-sm">
                    <p className="text-sm font-semibold text-[#9C5A22] mb-1">Total Baris</p>
                    <p className="text-3xl font-bold text-[#7A4520]">{previewData.total_rows}</p>
                  </div>
                  <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
                    <p className="text-sm font-semibold text-emerald-600 mb-1">Baris Valid</p>
                    <p className="text-3xl font-bold text-emerald-700">{previewData.valid_rows}</p>
                  </div>
                  <div className="bg-red-50 p-5 rounded-2xl border border-red-200 shadow-sm">
                    <p className="text-sm font-semibold text-red-600 mb-1">Baris Error</p>
                    <p className="text-3xl font-bold text-red-700">{previewData.error_rows}</p>
                  </div>
                </div>
              )}

              {previewData && previewData.error_rows > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-amber-800 font-semibold text-sm">Terdapat data yang tidak valid</h4>
                      <p className="text-amber-700 text-sm mt-1">Harap perbaiki file Excel Anda dan unggah ulang, atau baris yang error tidak dapat disimpan.</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2.5 rounded-xl border border-amber-200 shadow-sm hover:bg-amber-50/50 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      checked={showErrorsOnly}
                      onChange={(e) => {
                        setShowErrorsOnly(e.target.checked);
                        setCurrentPage(1); // Reset page on filter change
                      }}
                    />
                    <span className="text-sm font-bold text-amber-900 whitespace-nowrap">Hanya Tampilkan Error</span>
                  </label>
                </div>
              )}

              {/* Toolbar */}
              {previewData && (
                <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Cari teks soal..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E8DCC8] focus:border-[#D4924A] outline-none transition-all bg-white shadow-sm"
                    />
                  </div>
                  {previewData.error_rows === 0 && (
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-[#7C4318] focus:ring-[#9C5A22]"
                        checked={showErrorsOnly}
                        onChange={(e) => {
                          setShowErrorsOnly(e.target.checked);
                          setCurrentPage(1);
                        }}
                      />
                      <span className="text-sm font-bold text-gray-700 whitespace-nowrap">Hanya Tampilkan Error</span>
                    </label>
                  )}
                </div>
              )}

              {/* Data Table */}
              {previewData && previewData.data.length > 0 && (
                <div className="border border-[#E8DCC8] rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="table-header-premium">
                          <th className="table-header-cell-premium">#</th>
                          <th className="table-header-cell-premium whitespace-nowrap">K.ID</th>
                          <th className="table-header-cell-premium">Teks Soal</th>
                          <th className="table-header-cell-premium">Opsi A</th>
                          <th className="table-header-cell-premium">Opsi B</th>
                          <th className="table-header-cell-premium">Opsi C</th>
                          <th className="table-header-cell-premium">Opsi D</th>
                          <th className="table-header-cell-premium">Kunci</th>
                          <th className="table-header-cell-premium">Bobot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        {paginatedData.map((row) => (
                          <tr key={row.row} className={row.is_valid ? "table-row-premium group border-l-4 border-l-emerald-500" : "bg-red-50/50 hover:bg-red-50 transition-colors border-b border-gray-50 border-l-4 border-l-red-500 group"}>
                            <td className="table-cell-premium text-gray-500 font-medium whitespace-nowrap">{row.row}</td>
                            <td className="table-cell-premium text-gray-900">{row.category_id || "-"}</td>
                            <td className="table-cell-premium min-w-[200px]">
                              <p className="line-clamp-2 text-gray-900 group-hover:text-[#7C4318] transition-colors">{row.question_text || "-"}</p>
                              {!row.is_valid && row.error && (
                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium bg-red-100/50 px-2 py-1 rounded-md w-fit">
                                  <AlertCircle size={12} /> {row.error}
                                </p>
                              )}
                            </td>
                            <td className="table-cell-premium text-gray-600 text-xs min-w-[120px]"><p className="line-clamp-2">{row.option_a || "-"}</p></td>
                            <td className="table-cell-premium text-gray-600 text-xs min-w-[120px]"><p className="line-clamp-2">{row.option_b || "-"}</p></td>
                            <td className="table-cell-premium text-gray-600 text-xs min-w-[120px]"><p className="line-clamp-2">{row.option_c || "-"}</p></td>
                            <td className="table-cell-premium text-gray-600 text-xs min-w-[120px]"><p className="line-clamp-2">{row.option_d || "-"}</p></td>
                            <td className="table-cell-premium font-bold text-gray-900">{row.correct_answer || "-"}</td>
                            <td className="table-cell-premium font-semibold text-gray-900">{row.weight || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="px-5 py-4 border-t border-[#E8DCC8] bg-[#FAF7F2] flex flex-col sm:flex-row items-center justify-between gap-3">
                      <p className="text-sm text-gray-500 font-medium">
                        Menampilkan <span className="font-bold text-[#7A4520]">{startIndex + 1}</span> - <span className="font-bold text-[#7A4520]">{Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length)}</span> dari <span className="font-bold text-[#7A4520]">{filteredData.length}</span> baris
                      </p>
                      <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
          >
            Batal
          </button>
          {phase === "preview" && (
            <>
              <button
                onClick={() => {
                  setPhase("upload");
                  setPreviewData(null);
                  setFile(null);
                }}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-semibold bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Upload Ulang
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading || !previewData || previewData.error_rows > 0}
                className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#7C4318] to-[#9C5A22] text-white rounded-xl hover:from-[#5C3010] hover:to-[#7C4318] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Simpan {previewData?.valid_rows || 0} Soal
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
