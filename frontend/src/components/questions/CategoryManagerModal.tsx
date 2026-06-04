'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tag, Plus, Edit2, Trash2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import {
  listCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  deleteCategoryApi,
} from '@/services/category.service';
import type { Category, ApiErrorResponse } from '@/types/auth';

const schema = z.object({ name: z.string().min(2, 'Nama minimal 2 karakter') });
type FormValues = z.infer<typeof schema>;

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged: () => void; // dipanggil untuk reload dropdown di parent
}

export default function CategoryManagerModal({
  isOpen,
  onClose,
  onCategoriesChanged,
}: CategoryManagerModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteState, setDeleteState] = useState<{ id: number | null; name: string; loading: boolean }>({
    id: null,
    name: '',
    loading: false,
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listCategoriesApi(1, 100);
      setCategories(res.data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) fetchCategories();
  }, [isOpen, fetchCategories]);

  const handleSave = async (values: FormValues) => {
    setApiError(null);
    try {
      if (editingId !== null) {
        await updateCategoryApi(editingId, { name: values.name });
      } else {
        await createCategoryApi({ name: values.name });
      }
      reset({ name: '' });
      setEditingId(null);
      await fetchCategories();
      onCategoriesChanged();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as ApiErrorResponse)?.message ?? 'Gagal menyimpan kategori.'
        : 'Terjadi kesalahan.';
      setApiError(msg);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setValue('name', cat.name);
    setApiError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset({ name: '' });
    setApiError(null);
  };

  const handleDelete = async () => {
    if (deleteState.id === null) return;
    setDeleteState((s) => ({ ...s, loading: true }));
    setDeleteError(null);
    try {
      await deleteCategoryApi(deleteState.id);
      setDeleteState({ id: null, name: '', loading: false });
      await fetchCategories();
      onCategoriesChanged();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as ApiErrorResponse)?.message ?? 'Gagal menghapus kategori.'
        : 'Terjadi kesalahan.';
      setDeleteError(msg);
      setDeleteState((s) => ({ ...s, loading: false }));
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Kelola Kategori Soal" size="sm">
        {/* Inline Add/Edit Form */}
        <form onSubmit={handleSubmit(handleSave)} className="flex gap-2 mb-4" noValidate>
          <div className="flex-1">
            <input
              type="text"
              placeholder={editingId ? 'Ubah nama kategori...' : 'Nama kategori baru...'}
              {...register('name')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
            {apiError && (
              <p className="text-red-500 text-xs mt-1">{apiError}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition-all disabled:opacity-60 flex-shrink-0"
          >
            {isSubmitting ? <Spinner size={14} className="text-white" /> : <Plus size={15} />}
            {editingId ? 'Simpan' : 'Tambah'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50"
              title="Batal edit"
            >
              <X size={15} />
            </button>
          )}
        </form>

        {/* Category List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={20} className="text-amber-600" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Tag size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm">Belum ada kategori</p>
          </div>
        ) : (
          <ul className="space-y-1.5 max-h-72 overflow-y-auto">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  editingId === cat.id
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100/60'
                }`}
              >
                <Tag size={13} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-gray-800 text-sm font-medium truncate">
                  {cat.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50 transition-all"
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteState({ id: cat.id, name: cat.name, loading: false })}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    title="Hapus"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteState.id !== null}
        onClose={() => {
          setDeleteState({ id: null, name: '', loading: false });
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title="Hapus Kategori"
        message={`Yakin ingin menghapus kategori "${deleteState.name}"?`}
        isLoading={deleteState.loading}
        error={deleteError ?? undefined}
      />
    </>
  );
}
