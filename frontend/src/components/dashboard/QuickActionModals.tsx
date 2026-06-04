'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QuestionFormModal from '@/components/questions/QuestionFormModal';
import EventFormModal from '@/components/events/EventFormModal';
import UserFormModal from '@/components/users/UserFormModal';
import { useToast } from '@/components/ui/Toast';
import { listCategoriesApi } from '@/services/category.service';
import { createQuestionApi } from '@/services/question.service';
import { createEventApi } from '@/services/event.service';
import { createUserApi } from '@/services/user.service';
import type { Category } from '@/types/auth';

interface QuickActionModalsProps {
  actionToOpen: 'question' | 'event' | 'user' | null;
  onClose: () => void;
  addToast: (type: 'success' | 'error', message: string) => void;
}

export default function QuickActionModals({ actionToOpen, onClose, addToast }: QuickActionModalsProps) {
  const router = useRouter();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (actionToOpen === 'question' && categories.length === 0) {
      listCategoriesApi(100, 0, '').then(res => {
        setCategories(res.data || []);
      }).catch(err => {
        console.error('Failed to load categories', err);
      });
    }
  }, [actionToOpen, categories.length]);

  const handleClose = () => {
    setApiError(null);
    onClose();
  };

  const handleCreateQuestion = async (data: any) => {
    try {
      setApiError(null);
      await createQuestionApi(data);
      addToast('success', 'Soal berhasil ditambahkan');
      handleClose();
      router.push('/dashboard/questions');
    } catch (err: any) {
      setApiError(err.response?.data?.message || 'Gagal menambahkan soal');
    }
  };

  const handleCreateEvent = async (data: any) => {
    try {
      setApiError(null);
      await createEventApi(data);
      addToast('success', 'Event ujian berhasil dibuat');
      handleClose();
      router.push('/dashboard/events');
    } catch (err: any) {
      setApiError(err.response?.data?.message || 'Gagal membuat event ujian');
    }
  };

  const handleCreateUser = async (data: any) => {
    try {
      setApiError(null);
      await createUserApi(data);
      addToast('success', 'Peserta berhasil ditambahkan');
      handleClose();
      router.push('/dashboard/users');
    } catch (err: any) {
      setApiError(err.response?.data?.message || 'Gagal menambahkan peserta');
    }
  };

  return (
    <>
      {actionToOpen === 'question' && (
        <QuestionFormModal
          isOpen={true}
          onClose={handleClose}
          mode="create"
          categories={categories}
          onSubmit={handleCreateQuestion}
          apiError={apiError}
        />
      )}

      {actionToOpen === 'event' && (
        <EventFormModal
          isOpen={true}
          onClose={handleClose}
          mode="create"
          onSubmit={handleCreateEvent}
          apiError={apiError}
        />
      )}

      {actionToOpen === 'user' && (
        <UserFormModal
          isOpen={true}
          onClose={handleClose}
          mode="create"
          onSubmit={handleCreateUser}
          apiError={apiError}
        />
      )}
    </>
  );
}
