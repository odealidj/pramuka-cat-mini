'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Users,
  ClipboardList,
  Settings,
  ChevronRight,
  FlameKindling,
  X,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';

// --- Navigation Config ---
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/super-admin',
    icon: <LayoutDashboard size={18} />,
  },
  {
    label: 'Manajemen Admin',
    href: '/super-admin/users',
    icon: <ShieldCheck size={18} />,
  },
];

// --- Props ---
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  role?: 'admin' | 'peserta';
}

// --- NavLink Component ---
function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive =
    item.href === '/super-admin'
      ? pathname === '/super-admin'
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-200 relative overflow-hidden
        ${
          isActive
            ? 'sidebar-link-active text-white'
            : 'text-amber-100/70 hover:text-white hover:bg-white/10'
        }
      `}
    >
      <span
        className={`flex-shrink-0 ${isActive ? 'text-amber-200' : 'text-amber-300/60 group-hover:text-amber-200'}`}
      >
        {item.icon}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
          {item.badge}
        </span>
      )}
      {isActive && (
        <ChevronRight size={14} className="text-amber-200 flex-shrink-0" />
      )}
    </Link>
  );
}

// --- Main Sidebar ---
const SidebarContent = ({
  visibleNavItems,
  onClose,
}: {
  visibleNavItems: NavItem[];
  onClose: () => void;
}) => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/40 flex-shrink-0">
          <FlameKindling size={20} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight tracking-tight">
            Pramuka CAT
          </p>
          <p className="text-amber-300/60 text-xs font-medium">
            Sistem Ujian Digital
          </p>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <ShieldCheck
            size={14}
            className="text-purple-300"
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
            Super Admin
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300/40 mb-1">
          Menu Utama
        </p>
        {visibleNavItems.map((item) => (
          <NavLink key={item.href} item={item} onClick={onClose} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              Super Admin
            </p>
            <p className="text-amber-300/50 text-xs truncate">
              root@pramuka.id
            </p>
          </div>
        </div>
      </div>
    </div>
  );

export default function SuperAdminSidebar({ isOpen, onClose }: SidebarProps) {
  const visibleNavItems = navItems;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen bg-gradient-to-b from-[#5C3010] via-[#7C4318] to-[#5C3010] fixed left-0 top-0 z-30 shadow-2xl">
        <SidebarContent visibleNavItems={visibleNavItems} onClose={onClose} />
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`
          lg:hidden fixed left-0 top-0 h-screen w-72 z-50
          bg-gradient-to-b from-[#5C3010] via-[#7C4318] to-[#5C3010]
          shadow-2xl transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-amber-300/70 hover:text-white hover:bg-white/10"
          aria-label="Tutup menu"
        >
          <X size={18} />
        </button>
        <SidebarContent visibleNavItems={visibleNavItems} onClose={onClose} />
      </aside>
    </>
  );
}
