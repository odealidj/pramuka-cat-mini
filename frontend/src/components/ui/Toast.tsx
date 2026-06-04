'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

// ============================================================
// Toast Item (single notification)
// ============================================================
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg min-w-[280px] max-w-sm animate-in slide-in-from-right-5 fade-in duration-300 ${
        isSuccess
          ? 'bg-emerald-50 border border-emerald-200'
          : 'bg-red-50 border border-red-200'
      }`}
    >
      {isSuccess ? (
        <CheckCircle size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
      )}
      <p
        className={`flex-1 text-sm font-medium ${
          isSuccess ? 'text-emerald-800' : 'text-red-700'
        }`}
      >
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`flex-shrink-0 p-0.5 rounded-lg ${
          isSuccess ? 'text-emerald-500 hover:text-emerald-700' : 'text-red-400 hover:text-red-600'
        }`}
        aria-label="Tutup notifikasi"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ============================================================
// Toast Container (portal-like fixed position)
// ============================================================
export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ============================================================
// Custom Hook — useToast
// ============================================================
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message }]);
    },
    []
  );

  return { toasts, toast, dismiss };
}
