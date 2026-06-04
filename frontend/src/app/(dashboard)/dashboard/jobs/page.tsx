'use client';

import { useState, useEffect } from "react";
import { Server, Activity, AlertTriangle, RefreshCw, Trash2, CheckCircle, X, TerminalSquare, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInMemoryToken } from "@/lib/http-client";

export default function JobsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const token = getInMemoryToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/admin/dashboard/jobs`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Gagal memuat status job");
      const data = await res.json();
      setJobs(data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000); // Polling setiap 10 detik
    return () => clearInterval(interval);
  }, []);

  const clearFailedJobs = async () => {
    if (!confirm("Yakin ingin menghapus semua job yang gagal secara permanen?")) return;
    try {
      const token = getInMemoryToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/admin/dashboard/jobs/failed`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Gagal menghapus job gagal");
      fetchJobs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl">
        Akses Ditolak
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Background Jobs Monitoring</h1>
          <p className="text-gray-500 text-sm mt-1">Pantau antrean tugas di Redis via Asynq</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchJobs} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button onClick={clearFailedJobs} className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl hover:bg-red-100 text-sm font-medium transition-colors">
            <Trash2 size={16} />
            Bersihkan Gagal
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      {jobs.length === 0 && !loading && !error && (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-100">
          Belum ada data antrean job di Redis.
        </div>
      )}

      {jobs.map((queueData, idx) => (
        <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Server size={18} className="text-blue-600" />
              Antrean: {queueData.queue}
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
                <p className="text-blue-600 text-sm font-medium flex items-center gap-1.5"><Activity size={16}/> Active</p>
                <p className="text-2xl font-bold text-blue-700 mt-1.5">{queueData.active}</p>
              </div>
              <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
                <p className="text-amber-600 text-sm font-medium flex items-center gap-1.5"><RefreshCw size={16}/> Pending</p>
                <p className="text-2xl font-bold text-amber-700 mt-1.5">{queueData.pending}</p>
              </div>
              <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl">
                <p className="text-red-600 text-sm font-medium flex items-center gap-1.5"><AlertTriangle size={16}/> Failed</p>
                <p className="text-2xl font-bold text-red-700 mt-1.5">{queueData.failed}</p>
              </div>
              <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-xl">
                <p className="text-orange-600 text-sm font-medium flex items-center gap-1.5"><RefreshCw size={16}/> Retry</p>
                <p className="text-2xl font-bold text-orange-700 mt-1.5">{queueData.retry}</p>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
                <p className="text-emerald-600 text-sm font-medium flex items-center gap-1.5"><CheckCircle size={16}/> Completed</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1.5">{queueData.completed}</p>
              </div>
            </div>

            {queueData.failed_details && queueData.failed_details.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  Detail Job Gagal (Tersimpan di Redis)
                </h4>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Tipe Job</th>
                        <th className="px-4 py-3 font-semibold">Pesan Error</th>
                        <th className="px-4 py-3 font-semibold">Waktu Gagal</th>
                        <th className="px-4 py-3 font-semibold text-right">Percobaan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {queueData.failed_details.map((job: any, jIdx: number) => (
                        <tr key={jIdx} onClick={() => setSelectedJob(job)} className="hover:bg-red-50/50 transition-colors cursor-pointer group">
                          <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{job.type}</td>
                          <td className="px-4 py-3 text-red-600 max-w-md truncate" title={job.error}>{job.error}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(job.failed_at).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-gray-500 text-right">
                            {job.retried} / {job.max_retry}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                  <TerminalSquare size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Detail Job Gagal</h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {selectedJob.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedJob(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium mb-1">Tipe Job</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedJob.type}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium mb-1">Waktu Gagal</p>
                  <p className="text-sm font-semibold text-gray-900">{new Date(selectedJob.failed_at).toLocaleString('id-ID')}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" /> Pesan Error
                </p>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 font-mono whitespace-pre-wrap overflow-x-auto">
                  {selectedJob.error}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Server size={16} className="text-blue-500" /> Payload Data (JSON)
                </p>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedJob.payload), null, 2);
                      } catch (e) {
                        return selectedJob.payload || "Tidak ada payload";
                      }
                    })()}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
