'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, LayoutDashboard, Users, BookOpen, CalendarDays, Settings, ShieldCheck, ClipboardList, BarChart3, Command } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PaletteItem {
  id: string;
  label: string;
  type: 'navigate' | 'action';
  href?: string;
  actionId?: 'question' | 'event' | 'user';
  icon: React.ReactNode;
  roles: ('admin' | 'peserta' | 'super_admin')[];
  category: string;
}

const ITEMS: PaletteItem[] = [
  // Navigasi
  { id: 'nav-dashboard', label: 'Buka Dashboard', type: 'navigate', href: '/dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'peserta', 'super_admin'], category: 'Navigasi Menu' },
  { id: 'nav-questions', label: 'Buka Bank Soal', type: 'navigate', href: '/dashboard/questions', icon: <BookOpen size={18} />, roles: ['admin', 'super_admin'], category: 'Navigasi Menu' },
  { id: 'nav-categories', label: 'Buka Kategori Soal', type: 'navigate', href: '/dashboard/categories', icon: <ClipboardList size={18} />, roles: ['admin', 'super_admin'], category: 'Navigasi Menu' },
  { id: 'nav-events', label: 'Buka Jadwal Ujian', type: 'navigate', href: '/dashboard/events', icon: <CalendarDays size={18} />, roles: ['admin', 'peserta', 'super_admin'], category: 'Navigasi Menu' },
  { id: 'nav-results', label: 'Buka Hasil Ujian', type: 'navigate', href: '/dashboard/results', icon: <BarChart3 size={18} />, roles: ['admin', 'super_admin'], category: 'Navigasi Menu' },
  { id: 'nav-users', label: 'Buka Manajemen Pengguna', type: 'navigate', href: '/dashboard/users', icon: <Users size={18} />, roles: ['admin', 'super_admin'], category: 'Navigasi Menu' },
  { id: 'nav-profile', label: 'Buka Profil Saya & Pengaturan', type: 'navigate', href: '/dashboard/profile', icon: <Settings size={18} />, roles: ['admin', 'peserta', 'super_admin'], category: 'Navigasi Menu' },
  
  // Aksi Cepat
  { id: 'act-question', label: 'Buat Soal Baru', type: 'action', actionId: 'question', icon: <Plus size={18} />, roles: ['admin', 'super_admin'], category: 'Aksi Cepat' },
  { id: 'act-event', label: 'Buat Jadwal Ujian Baru', type: 'action', actionId: 'event', icon: <Plus size={18} />, roles: ['admin', 'super_admin'], category: 'Aksi Cepat' },
  { id: 'act-user', label: 'Tambah Peserta Baru', type: 'action', actionId: 'user', icon: <Plus size={18} />, roles: ['admin', 'super_admin'], category: 'Aksi Cepat' },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const onClose = () => setIsOpen(false);

  const role = user?.role || 'peserta';

  // Filter items based on role and query
  const filteredItems = ITEMS.filter(item => 
    item.roles.includes(role as any) && 
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  // Group by category for rendering
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PaletteItem[]>);

  // Reset selection when query changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [query, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
    }
  }, [isOpen]);

  // Handle global shortcut (Ctrl+K / Cmd+K) and custom event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    
    const handleOpenEvent = () => setIsOpen(true);
    
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('openCommandPalette', handleOpenEvent);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('openCommandPalette', handleOpenEvent);
    };
  }, []);

  const handleSelect = (item: PaletteItem) => {
    if (item.type === 'navigate' && item.href) {
      router.push(item.href);
    } else if (item.type === 'action' && item.actionId) {
      // Dispatch a custom event to trigger quick action modals in the layout
      window.dispatchEvent(new CustomEvent('triggerQuickAction', { detail: item.actionId }));
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 sm:pt-32 px-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div 
        className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden ring-1 ring-white/10 border border-[#E8DCC8] flex flex-col transform scale-100 animate-in fade-in zoom-in duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Search Input */}
        <div className="flex items-center px-6 py-5 border-b border-[#E8DCC8] bg-gradient-to-r from-[#FAF7F2] to-white relative overflow-hidden">
          <Search size={24} className="text-[#D4924A] flex-shrink-0 relative z-10" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none px-4 py-1 text-[#5C3010] placeholder-[#D4924A]/60 text-lg font-bold relative z-10"
            placeholder="Cari menu atau perintah..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-1.5 hidden sm:flex relative z-10">
             <kbd className="bg-white text-[#9C5A22] rounded-md px-2 py-1 text-[11px] font-bold border border-[#E8DCC8] shadow-sm uppercase tracking-widest">ESC</kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[28rem] overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-[#E8DCC8] scrollbar-track-transparent" onMouseLeave={() => setSelectedIndex(-1)}>
          {filteredItems.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-16 h-16 bg-[#FAF7F2] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#E8DCC8]">
                <Search size={28} className="text-[#D4924A]/60" />
              </div>
              <p className="text-[#5C3010] font-extrabold text-lg">Pencarian tidak ditemukan.</p>
              <p className="text-[#7A4520] text-sm mt-1 font-medium">Coba gunakan kata kunci lain.</p>
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="mb-6 last:mb-0">
                <div className="px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#D4924A]/70 mb-2">
                  {category}
                </div>
                <div className="space-y-1">
                  {items.map((item) => {
                    const globalIndex = filteredItems.findIndex(i => i.id === item.id);
                    const isSelected = selectedIndex === globalIndex;
                    return (
                      <button
                        key={item.id}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 cursor-pointer
                          ${isSelected ? 'bg-gradient-to-r from-[#FAF7F2] to-white border-l-4 border-[#D4924A] shadow-sm ring-1 ring-[#E8DCC8]' : 'border-l-4 border-transparent hover:bg-gray-50 text-[#7A4520]'}`}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        onClick={() => handleSelect(item)}
                      >
                        <div className={`p-2.5 rounded-xl transition-colors duration-300 ${isSelected ? 'bg-[#9C5A22] text-white shadow-md' : 'bg-[#FAF7F2] text-[#9C5A22] border border-[#E8DCC8]'}`}>
                          {item.icon}
                        </div>
                        <span className={`font-bold text-base transition-colors duration-300 ${isSelected ? 'text-[#5C3010]' : ''}`}>
                          {item.label}
                        </span>
                        {isSelected && (
                          <div className="ml-auto flex items-center">
                            <span className="text-xs text-[#9C5A22] font-black uppercase tracking-widest bg-[#D4924A]/10 px-2.5 py-1 rounded-md">
                              Enter ↵
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer info */}
        <div className="px-6 py-4 border-t border-[#E8DCC8] bg-gradient-to-r from-gray-50 to-white text-xs text-[#7A4520] flex justify-between items-center hidden sm:flex font-bold">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2"><kbd className="bg-white rounded px-1.5 py-0.5 text-[11px] border border-[#E8DCC8] shadow-sm text-[#9C5A22]">↑</kbd><kbd className="bg-white rounded px-1.5 py-0.5 text-[11px] border border-[#E8DCC8] shadow-sm text-[#9C5A22]">↓</kbd> Navigasi</span>
            <span className="flex items-center gap-2"><kbd className="bg-white rounded px-1.5 py-0.5 text-[11px] border border-[#E8DCC8] shadow-sm text-[#9C5A22]">↵</kbd> Pilih</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#5C3010] uppercase tracking-widest font-black">
            Pramuka CAT <Command size={12} className="ml-1 text-[#D4924A]" />
          </div>
        </div>
      </div>
    </div>
  );
}
