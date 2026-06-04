import { ShieldCheck } from 'lucide-react';

export default function SuperAdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-r from-[#FAF7F2] to-white p-6 rounded-2xl shadow-sm border border-[#E8DCC8] flex items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#E8DCC8]/40 to-transparent rounded-full -mr-20 -mt-20 blur-2xl"></div>
        <div className="w-16 h-16 rounded-xl bg-white border border-[#E8DCC8] shadow-sm flex flex-col items-center justify-center text-[#9C5A22] relative z-10">
          <ShieldCheck size={32} />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-[#5C3010]">
            Selamat Datang, Super Admin!
          </h1>
          <p className="text-[#7A4520] font-medium mt-1">
            Anda berada di area kendali utama Pramuka CAT.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E8DCC8] hover:border-[#D4924A] hover:shadow-md transition-all group cursor-pointer relative overflow-hidden">
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-gradient-to-tl from-[#FAF7F2] to-transparent rounded-tl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h3 className="text-xs font-bold text-[#9C5A22] uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4924A]"></span> Total Admin
          </h3>
          <p className="text-3xl font-black text-[#5C3010]">Kelola Admin</p>
          <p className="text-sm text-[#7A4520] mt-3 leading-relaxed">Hanya Super Admin yang dapat menambah atau menghapus panitia (Admin).</p>
        </div>
      </div>
    </div>
  );
}
