'use client';

import { Bell, Menu, Search, LogOut, User, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Spinner from '@/components/ui/Spinner';
import { getPhotoUrl } from '@/lib/constants';
import NotificationDropdown from './NotificationDropdown';

interface NavbarProps {
  onMenuToggle: () => void;
  pageTitle?: string;
  isCollapsed?: boolean;
}

/** Menghasilkan inisial dari nama lengkap (misal: "Budi Santoso" → "BS") */
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('');
}

export default function Navbar({ onMenuToggle, pageTitle = 'Dashboard', isCollapsed = false }: NavbarProps) {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setIsProfileOpen(false);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName = user?.full_name || user?.username || 'Pengguna';
  const initials = getInitials(displayName);
  const roleLabel = user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin / Panitia' : 'Peserta';

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
      <div className="flex items-center gap-3 h-full px-4 lg:px-6">

        {/* Hamburger (Mobile only) */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 flex-shrink-0"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        {/* Page Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-gray-900 font-semibold text-base truncate">
            {isCollapsed
              ? `Pramuka CAT — ${pageTitle}`
              : pageTitle}
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">

          {/* Search — Desktop */}
          <button 
            onClick={() => document.dispatchEvent(new CustomEvent('openCommandPalette'))}
            className="hidden md:flex items-center justify-between gap-2 bg-[#FAF7F2] hover:bg-[#E8DCC8]/50 transition-colors rounded-xl px-3 py-2 w-56 text-sm text-[#9C5A22] border border-[#E8DCC8] shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-[#9C5A22]" />
              <span className="font-medium">Cari sesuatu...</span>
            </div>
            <div className="flex items-center gap-0.5">
              <kbd className="bg-white px-1.5 py-0.5 rounded text-[10px] font-bold text-[#7C4318] shadow-sm border border-[#E8DCC8]">Ctrl</kbd>
              <kbd className="bg-white px-1.5 py-0.5 rounded text-[10px] font-bold text-[#7C4318] shadow-sm border border-[#E8DCC8]">K</kbd>
            </div>
          </button>

          {/* Search — Mobile Toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => document.dispatchEvent(new CustomEvent('openCommandPalette'))}
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          {/* Notification Bell */}
          <NotificationDropdown />

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl hover:bg-[#FAF7F2] transition-all border border-transparent hover:border-[#E8DCC8]"
              aria-label="Profile menu"
            >
              {/* Avatar with Initials or Photo */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4924A] to-[#7C4318] flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0 overflow-hidden border border-[#9C5A22]">
                {user?.photo_url ? (
                  <img src={getPhotoUrl(user.photo_url) || ''} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[#5C3010] text-sm font-bold leading-tight truncate max-w-[120px]">
                  {displayName}
                </p>
                <p className="text-[#9C5A22] text-xs font-medium">{roleLabel}</p>
              </div>
              <ChevronDown
                size={14}
                className={`text-[#9C5A22] transition-transform hidden sm:block ${
                  isProfileOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-[#E8DCC8] overflow-hidden z-50">
                {/* User Info */}
                <div className="px-4 py-3 bg-gradient-to-br from-[#FAF7F2] to-white border-b border-[#E8DCC8]">
                  <p className="text-[#5C3010] text-sm font-extrabold truncate">
                    {displayName}
                  </p>
                  <p className="text-[#9C5A22] text-xs font-medium">{user?.username}</p>
                  <span className="inline-block mt-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#D4924A] to-[#7C4318] text-white shadow-sm">
                    {roleLabel}
                  </span>
                </div>

                <div className="p-2">
                  <Link
                    href={user?.role === 'super_admin' ? '/super-admin/profile' : '/dashboard/profile'}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-[#7C4318] hover:bg-[#FAF7F2] hover:text-[#5C3010] font-bold text-sm transition-colors"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <User size={15} className="text-[#9C5A22]" />
                    Pengaturan Akun
                  </Link>
                </div>

                <div className="p-2 pt-0 border-t border-gray-100">
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-sm font-medium disabled:opacity-50"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    id="btn-logout"
                  >
                    {isLoggingOut ? (
                      <Spinner size={15} className="text-red-500" />
                    ) : (
                      <LogOut size={15} />
                    )}
                    {isLoggingOut ? 'Keluar...' : 'Keluar'}
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>

      
    </header>
  );
}
