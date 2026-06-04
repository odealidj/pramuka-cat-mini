'use client';

import { useState } from 'react';
import SuperAdminSidebar from '@/components/layout/SuperAdminSidebar';
import Navbar from '@/components/layout/Navbar';
import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';

// Mapping path → page title
const pageTitles: Record<string, string> = {
  '/super-admin': 'Super Admin Dashboard',
  '/super-admin/users': 'Manajemen Admin',
};

function SuperAdminContent({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] ?? 'Super Admin';

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <SuperAdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area (offset by sidebar width on desktop) */}
      <div className="flex flex-col flex-1 min-h-screen lg:ml-64">
        {/* Navbar */}
        <Navbar
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          pageTitle={pageTitle}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 px-6 py-3 bg-white">
          <p className="text-gray-400 text-xs text-center">
            © {new Date().getFullYear()} Pramuka CAT — Sistem Ujian Digital. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['super_admin']}>
      <SuperAdminContent>{children}</SuperAdminContent>
    </AuthGuard>
  );
}
