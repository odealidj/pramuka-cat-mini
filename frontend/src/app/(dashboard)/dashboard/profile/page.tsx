'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { uploadPhotoApi, updateProfileApi, changePasswordApi } from '@/services/user.service';
import { Camera, User as UserIcon, Upload, CheckCircle, AlertCircle, Save, Lock, Bell, KeyRound, Edit2, X } from 'lucide-react';
import { getPhotoUrl } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import { isAxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types/auth';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();

  // Profil
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', username: '', email: '', email_notifications: true });
  const [isSaving, setIsSaving] = useState(false);

  // Keamanan
  const [passwordData, setPasswordData] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Notifikasi
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Status Pesan (Bisa banyak pesan per kategori, tapi untuk simpel kita jadikan state terpisah atau global page)
  const [errorMsg, setErrorMsg] = useState<{ type: string; msg: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ type: string; msg: string } | null>(null);

  // Photo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        username: user.username || '',
        email: user.email || '',
        email_notifications: user.email_notifications ?? true
      });
      setEmailNotifications(user.email_notifications ?? true);
    }
  }, [user]);

  const showMsg = (type: string, msg: string, isError: boolean = false) => {
    if (isError) {
      setErrorMsg({ type, msg });
      setSuccessMsg(null);
    } else {
      setSuccessMsg({ type, msg });
      setErrorMsg(null);
    }
    // Auto clear after 5s
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 5000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showMsg('photo', 'Ukuran file maksimal 5MB.', true);
      return;
    }
    if (!file.type.startsWith('image/')) {
      showMsg('photo', 'Hanya file gambar (JPG/PNG) yang diperbolehkan.', true);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const res = await uploadPhotoApi(selectedFile);
      
      // Update global context & session storage. Tambahkan ?t= untuk mem-bypass cache browser.
      const updatedPhotoUrl = `${res.photo_url}?t=${new Date().getTime()}`;
      updateUser({ photo_url: updatedPhotoUrl });
      
      showMsg('photo', 'Foto profil berhasil diperbarui!');
      setSelectedFile(null);
    } catch (err) {
      if (isAxiosError(err)) {
        showMsg('photo', (err.response?.data as ApiErrorResponse)?.message || 'Gagal mengunggah foto.', true);
      } else {
        showMsg('photo', 'Terjadi kesalahan internal.', true);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleProfileSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateProfileApi(formData);
      updateUser({ full_name: res.full_name, username: res.username, email: res.email, email_notifications: res.email_notifications });
      showMsg('profile', 'Profil berhasil diperbarui!');
      setIsEditing(false);
    } catch (err) {
      if (isAxiosError(err)) {
        showMsg('profile', (err.response?.data as ApiErrorResponse)?.message || 'Gagal memperbarui profil.', true);
      } else {
        showMsg('profile', 'Terjadi kesalahan internal.', true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      showMsg('password', 'Konfirmasi kata sandi baru tidak cocok.', true);
      return;
    }
    if (passwordData.new_password.length < 6) {
      showMsg('password', 'Kata sandi baru minimal 6 karakter.', true);
      return;
    }

    setIsSavingPassword(true);
    try {
      await changePasswordApi({
        old_password: passwordData.old_password,
        new_password: passwordData.new_password
      });
      showMsg('password', 'Kata sandi berhasil diperbarui!');
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      if (isAxiosError(err)) {
        showMsg('password', (err.response?.data as ApiErrorResponse)?.message || 'Gagal memperbarui kata sandi.', true);
      } else {
        showMsg('password', 'Terjadi kesalahan internal.', true);
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleNotificationsSave = async () => {
    setIsSavingNotifications(true);
    try {
      const payload = { ...formData, email_notifications: emailNotifications };
      const res = await updateProfileApi(payload);
      updateUser({ email_notifications: res.email_notifications });
      showMsg('notifications', 'Preferensi notifikasi berhasil disimpan!');
    } catch (err) {
      if (isAxiosError(err)) {
        showMsg('notifications', (err.response?.data as ApiErrorResponse)?.message || 'Gagal menyimpan preferensi.', true);
      } else {
        showMsg('notifications', 'Terjadi kesalahan internal.', true);
      }
    } finally {
      setIsSavingNotifications(false);
    }
  };

  if (!user) return null;

  const displayPhotoUrl = previewUrl || getPhotoUrl(user.photo_url);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Banner / Header Card */}
      <div className="bg-white rounded-3xl border border-[#E8DCC8] shadow-sm hover:shadow-md hover:border-[#D4924A] transition-all duration-300 p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60"></div>
        
        {/* Photo Upload Area */}
        <div className="relative group shrink-0">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center relative">
            {displayPhotoUrl ? (
              <img src={displayPhotoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={48} className="text-gray-300" />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                 onClick={() => fileInputRef.current?.click()}>
              <Camera size={28} className="text-white" />
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={handleFileChange} />
          
          <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-amber-600 text-white rounded-full shadow-md hover:bg-amber-700 transition-transform hover:scale-105">
            <Camera size={16} />
          </button>
        </div>

        <div className="flex-1 text-center sm:text-left z-10 pt-2 sm:pt-4">
          <h1 className="text-gray-900 text-2xl sm:text-3xl font-extrabold">{user.full_name}</h1>
          <p className="text-gray-500 font-medium mb-3">@{user.username}</p>
          <div className="inline-flex px-3 py-1 bg-gradient-to-r from-[#D4924A] to-[#7C4318] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
            {user.role}
          </div>

          {selectedFile && (
            <div className="mt-4 flex items-center justify-center sm:justify-start gap-3">
              <button onClick={handleUpload} disabled={isUploading} className="flex items-center gap-2 bg-[#7C4318] text-white text-sm font-semibold py-2 px-5 rounded-xl hover:bg-[#5C3010] transition-all shadow-md shadow-[#7C4318]/20">
                {isUploading ? <Spinner size={16} className="text-white/80" /> : <Upload size={16} />} Simpan Foto
              </button>
              <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
          )}

          {errorMsg?.type === 'photo' && <p className="text-red-500 text-sm font-medium mt-3">{errorMsg.msg}</p>}
          {successMsg?.type === 'photo' && <p className="text-emerald-600 text-sm font-medium mt-3">{successMsg.msg}</p>}
        </div>
      </div>

      {/* Grid Layout for Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Personal Info */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E8DCC8] shadow-sm hover:shadow-md hover:border-[#D4924A] transition-all duration-300 p-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-gray-800 text-lg font-bold flex items-center gap-2">
              <UserIcon size={20} className="text-[#9C5A22]" /> Informasi Pribadi
            </h3>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 text-[#9C5A22] text-sm font-bold hover:bg-[#E8DCC8]/50 bg-[#FAF7F2] px-3 py-1.5 rounded-lg transition-colors border border-[#E8DCC8]">
                <Edit2 size={14} /> Edit
              </button>
            ) : (
              <button onClick={() => { setIsEditing(false); setFormData({ ...formData, full_name: user.full_name, username: user.username, email: user.email || '' }); }} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-bold bg-gray-50 px-3 py-1.5 rounded-lg transition-colors border border-gray-200">
                <X size={14} /> Batal
              </button>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[#7C4318] mb-1.5">Nama Lengkap</label>
              {isEditing ? (
                <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E8DCC8] rounded-xl text-sm focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] outline-none transition-all text-[#5C3010] font-medium" />
              ) : (
                <div className="w-full px-4 py-2.5 bg-[#FAF7F2]/50 border border-transparent rounded-xl text-[#5C3010] text-sm font-bold">{user.full_name}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-[#7C4318] mb-1.5">Username</label>
              {isEditing ? (
                <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E8DCC8] rounded-xl text-sm focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] outline-none transition-all text-[#5C3010] font-medium" />
              ) : (
                <div className="w-full px-4 py-2.5 bg-[#FAF7F2]/50 border border-transparent rounded-xl text-[#5C3010] text-sm font-bold">{user.username}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-[#7C4318] mb-1.5">Email</label>
              {isEditing ? (
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E8DCC8] rounded-xl text-sm focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] outline-none transition-all text-[#5C3010] font-medium" />
              ) : (
                <div className="w-full px-4 py-2.5 bg-[#FAF7F2]/50 border border-transparent rounded-xl text-[#5C3010] text-sm font-bold">{user.email || <span className="text-gray-400 italic font-normal">Belum diatur</span>}</div>
              )}
            </div>

            {errorMsg?.type === 'profile' && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm">
                <AlertCircle size={16} /> {errorMsg.msg}
              </div>
            )}
            {successMsg?.type === 'profile' && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-xl text-sm">
                <CheckCircle size={16} /> {successMsg.msg}
              </div>
            )}

            {isEditing && (
              <div className="pt-2">
                <button onClick={handleProfileSave} disabled={isSaving || !formData.full_name || !formData.username || !formData.email} className="w-full flex justify-center items-center gap-2 bg-[#7C4318] hover:bg-[#5C3010] text-white py-3 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50">
                  {isSaving ? <Spinner size={18} className="text-white" /> : <Save size={18} />} Simpan Profil Pribadi
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Security & Notifications */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Security Card */}
          <div className="bg-white rounded-3xl border border-[#E8DCC8] shadow-sm hover:shadow-md hover:border-[#D4924A] transition-all duration-300 p-6 sm:p-8">
            <div className="mb-6">
              <h3 className="text-gray-800 text-lg font-bold flex items-center gap-2">
                <KeyRound size={20} className="text-[#9C5A22]" /> Keamanan Akun
              </h3>
              <p className="text-sm text-gray-500 mt-1 font-medium">Perbarui kata sandi Anda secara berkala.</p>
            </div>

            <div className="space-y-4">
              <div>
                <input type="password" value={passwordData.old_password} onChange={e => setPasswordData({...passwordData, old_password: e.target.value})} className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E8DCC8] rounded-xl text-sm focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] outline-none transition-all placeholder:text-gray-400 text-[#5C3010] font-medium" placeholder="Kata Sandi Saat Ini" />
              </div>
              <div>
                <input type="password" value={passwordData.new_password} onChange={e => setPasswordData({...passwordData, new_password: e.target.value})} className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E8DCC8] rounded-xl text-sm focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] outline-none transition-all placeholder:text-gray-400 text-[#5C3010] font-medium" placeholder="Kata Sandi Baru" />
              </div>
              <div>
                <input type="password" value={passwordData.confirm_password} onChange={e => setPasswordData({...passwordData, confirm_password: e.target.value})} className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E8DCC8] rounded-xl text-sm focus:ring-2 focus:ring-[#D4924A]/30 focus:border-[#D4924A] outline-none transition-all placeholder:text-gray-400 text-[#5C3010] font-medium" placeholder="Konfirmasi Kata Sandi Baru" />
              </div>

              {errorMsg?.type === 'password' && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm mt-2">
                  <AlertCircle size={16} /> {errorMsg.msg}
                </div>
              )}
              {successMsg?.type === 'password' && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-xl text-sm mt-2">
                  <CheckCircle size={16} /> {successMsg.msg}
                </div>
              )}

              <button onClick={handlePasswordSave} disabled={isSavingPassword || !passwordData.old_password || !passwordData.new_password || !passwordData.confirm_password} className="w-full flex justify-center items-center gap-2 bg-[#FAF7F2] border border-[#E8DCC8] text-[#9C5A22] hover:bg-[#7C4318] hover:text-white hover:border-[#7C4318] py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 shadow-sm">
                {isSavingPassword ? <Spinner size={16} className="text-current" /> : <Lock size={16} />} Perbarui Kata Sandi
              </button>
            </div>
          </div>

          {/* Notifications Card */}
          <div className="bg-gradient-to-br from-[#D4924A] to-[#7C4318] rounded-3xl border border-[#9C5A22] shadow-sm p-6 sm:p-8 text-white relative overflow-hidden hover:shadow-md transition-all duration-300">
            <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
              <Bell size={120} />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-white text-lg font-bold flex items-center gap-2 mb-2">
                <Bell size={20} /> Notifikasi Email
              </h3>
              <p className="text-[#FAF7F2]/80 text-sm mb-6 max-w-[90%] font-medium">
                Terima pemberitahuan penting seperti jadwal ujian baru atau hasil kelulusan langsung ke email Anda.
              </p>

              <div className="flex items-center justify-between bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner">
                <span className="font-bold text-sm">Status Notifikasi</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} />
                  <div className="w-11 h-6 bg-black/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#E8DCC8] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5C3010] shadow-inner"></div>
                </label>
              </div>

              {errorMsg?.type === 'notifications' && <p className="text-red-200 text-sm font-medium mt-3">{errorMsg.msg}</p>}
              {successMsg?.type === 'notifications' && <p className="text-emerald-100 text-sm font-medium mt-3">{successMsg.msg}</p>}

              <button onClick={handleNotificationsSave} disabled={isSavingNotifications} className="w-full mt-4 flex justify-center items-center gap-2 bg-[#FAF7F2] text-[#9C5A22] hover:bg-white hover:text-[#7C4318] py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 shadow-sm">
                {isSavingNotifications ? <Spinner size={16} className="text-[#7C4318]" /> : <Save size={16} />} Simpan Preferensi
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
