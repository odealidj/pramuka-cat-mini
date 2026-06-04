'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import QuickActionModals from '@/components/dashboard/QuickActionModals';
import CommandPalette from '@/components/layout/CommandPalette';
import { ToastContainer, useToast } from '@/components/ui/Toast';

// Mapping path → page title
const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/questions': 'Bank Soal',
  '/dashboard/categories': 'Kategori Soal',
  '/dashboard/events': 'Jadwal Ujian',
  '/dashboard/results': 'Hasil Ujian',
  '/dashboard/users': 'Manajemen Pengguna',
  '/dashboard/jobs': 'Monitoring Jobs',
  '/dashboard/profile': 'Pengaturan Akun',
};

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [quickAction, setQuickAction] = useState<'question' | 'event' | 'user' | null>(null);
  const { toasts, toast: addToast, dismiss } = useToast();
  
  const pathname = usePathname();
  let pageTitle = pageTitles[pathname] ?? 'Halaman';
  if (pathname.startsWith('/dashboard/events/') && pathname !== '/dashboard/events') {
    pageTitle = 'Kelola Jadwal Ujian';
  }
  const { user } = useAuth();
  
  const isExamMode = pathname.includes('/dashboard/exams/');

  // Listen for quick actions from CommandPalette
  useEffect(() => {
    const handleQuickAction = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setQuickAction(customEvent.detail as 'question' | 'event' | 'user');
    };
    window.addEventListener('triggerQuickAction', handleQuickAction);
    return () => window.removeEventListener('triggerQuickAction', handleQuickAction);
  }, []);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar - Hidden in Exam Mode */}
      {!isExamMode && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          role={(user?.role as 'admin' | 'peserta') ?? 'peserta'}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      )}

      {/* Main Content Area */}
      <div className={`flex flex-col flex-1 h-screen overflow-hidden transition-all duration-300 ${!isExamMode ? (isCollapsed ? 'lg:ml-20' : 'lg:ml-64') : ''}`}>
        {!isExamMode && (
          <Navbar
            onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            pageTitle={pageTitle}
            isCollapsed={isCollapsed}
          />
        )}

        {/* Page Content */}
        <main className={`flex-1 overflow-auto bg-[#FAF7F2] ${isExamMode ? 'p-0' : 'p-4 lg:p-6'}`}>
          {children}
        </main>

        {/* Footer - Hidden in Exam Mode */}
        {!isExamMode && (
          <footer className="border-t border-[#E8DCC8] px-6 py-4 bg-transparent">
            <p className="text-[#7A4520]/70 font-medium text-xs text-center tracking-wide">
              © {new Date().getFullYear()} Pramuka CAT — Sistem Ujian Digital. All rights reserved.
            </p>
          </footer>
        )}
      </div>

      <QuickActionModals 
        actionToOpen={quickAction} 
        onClose={() => setQuickAction(null)} 
        addToast={addToast}
      />
      <CommandPalette />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['admin', 'peserta']}>
      <DashboardContent>{children}</DashboardContent>
    </AuthGuard>
  );
}
