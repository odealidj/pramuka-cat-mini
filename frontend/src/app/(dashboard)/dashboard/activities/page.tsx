'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardApi, DashboardActivity } from "@/lib/api/dashboard";
import { ChevronLeft, ChevronRight, Activity, ArrowLeft, X, Eye } from "lucide-react";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import { getPhotoUrl } from "@/lib/constants";

export default function ActivitiesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState<DashboardActivity | null>(null);

  const limit = 10;

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const res = await dashboardApi.getActivities(page, limit);
        setActivities(res.data.data);
        setTotalPages(res.data.total_pages);
        setTotalItems(res.data.total_items);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching activities:", err);
        setError("Gagal memuat log aktivitas. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      fetchActivities();
    } else {
      setLoading(false);
    }
  }, [page, isAdmin]);

  if (!isAdmin && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Activity size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
        <p className="text-gray-500 mb-6">
          Anda tidak memiliki izin untuk melihat halaman ini.
        </p>
        <Link
          href="/dashboard"
          className="px-6 py-2.5 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 transition-colors"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const renderActivityItem = (a: DashboardActivity, index: number) => {
    // Determine relative time
    const date = new Date(a.time);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    let timeStr = "";
    if (diffInSeconds < 60) timeStr = "Baru saja";
    else if (diffInSeconds < 3600) timeStr = `${Math.floor(diffInSeconds / 60)} menit lalu`;
    else if (diffInSeconds < 86400) timeStr = `${Math.floor(diffInSeconds / 3600)} jam lalu`;
    else timeStr = `${Math.floor(diffInSeconds / 86400)} hari lalu`;
    
    let statusConfig: "pending" | "completed" | "approved" | "expired" | "revoked" = "pending";
    if (a.status === "completed" || a.action.includes("Menyelesaikan")) {
      statusConfig = "completed";
    } else if (a.status === "approved") {
      statusConfig = "approved";
    } else if (a.status === "revoked") {
      statusConfig = "revoked";
    } else if (a.status === "pending" && a.event_end_time) {
      if (now.getTime() > new Date(a.event_end_time).getTime()) {
        statusConfig = "expired";
      }
    }

    const sConfig = {
      approved: {
        label: "Disetujui",
        cls: "bg-[#FAF7F2] text-[#7A4520] border-[#E8DCC8]",
      },
      pending: {
        label: "Menunggu",
        cls: "bg-amber-50 text-amber-700 border-amber-200",
      },
      completed: {
        label: "Selesai",
        cls: "bg-blue-50 text-blue-700 border-blue-200",
      },
      expired: {
        label: "Waktu Habis",
        cls: "bg-gray-50 text-gray-600 border-gray-200",
      },
      revoked: {
        label: "Dibatalkan",
        cls: "bg-red-50 text-red-700 border-red-200",
      },
    };
    const s = sConfig[statusConfig];

    return (
      <div 
        key={index} 
        onClick={() => setSelectedActivity(a)}
        className="flex items-center gap-4 py-4 border-b border-gray-50 last:border-0 hover:bg-[#FAF7F2] transition-colors px-4 rounded-xl cursor-pointer group"
      >
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden shadow-sm border border-white/50 group-hover:scale-105 transition-transform">
          {a.photo_url ? (
            <img src={getPhotoUrl(a.photo_url) || ''} alt={a.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#E8B478] to-[#9C5A22] flex items-center justify-center shadow-inner">
              {a.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gray-800 text-sm font-semibold truncate group-hover:text-[#7A4520] transition-colors">{a.name}</p>
          <p className="text-gray-500 text-sm truncate mt-0.5">{a.action}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.cls}`}
          >
            {s.label}
          </span>
          <span className="text-gray-400 text-xs flex items-center gap-1">
            {timeStr}
            <Eye size={12} className="opacity-0 group-hover:opacity-100 text-[#9C5A22] transition-opacity" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/dashboard"
          className="group flex items-center justify-center w-10 h-10 bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md hover:border-[#D4924A] transition-all"
        >
          <ArrowLeft size={20} className="text-gray-500 group-hover:text-[#9C5A22] transition-colors" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Log Aktivitas</h1>
          <p className="text-gray-500 text-sm">Jejak rekam aktivitas peserta di dalam sistem.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[400px] flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 flex-1">
            <Spinner size={32} className="text-[#9C5A22] mb-4" />
            <p className="text-gray-500 text-sm">Memuat log aktivitas...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-500 flex-1">
            <Activity size={48} className="mb-4 opacity-50" />
            <p className="font-medium">{error}</p>
          </div>
        ) : activities.length > 0 ? (
          <>
            <div className="flex-1">
              {activities.map((a, i) => renderActivityItem(a, i))}
            </div>

            {/* Pagination Controls */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between border-t border-gray-100 pt-6 gap-4">
              <span className="text-sm text-gray-500">
                Menampilkan <span className="font-semibold text-[#7C4318]">{activities.length}</span> dari <span className="font-semibold text-gray-900">{totalItems}</span> aktivitas
              </span>
              
              <Pagination 
                page={page} 
                totalPages={totalPages} 
                onPageChange={setPage} 
                isLoading={loading} 
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 flex-1">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
              <Activity size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Belum ada aktivitas di dalam sistem.</p>
          </div>
        )}
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-[#FAF7F2]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E8B478] to-[#9C5A22] border-2 border-white/50 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {selectedActivity.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{selectedActivity.name}</h3>
                  <p className="text-xs text-[#9C5A22] font-medium mt-0.5">Detail Aktivitas</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedActivity(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Aktivitas</p>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-gray-800 font-medium">
                  {selectedActivity.action}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
                  <p className="font-semibold text-gray-900 capitalize">{selectedActivity.status}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Waktu</p>
                  <p className="font-semibold text-gray-900">{new Date(selectedActivity.time).toLocaleString('id-ID')}</p>
                </div>
              </div>
              
              {selectedActivity.event_end_time && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 font-medium mb-1">Batas Waktu Ujian</p>
                  <p className="font-semibold text-gray-900">{new Date(selectedActivity.event_end_time).toLocaleString('id-ID')}</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setSelectedActivity(null)}
                className="px-5 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
