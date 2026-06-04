import httpClient from '@/lib/http-client';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const getNotificationsApi = async () => {
  const response = await httpClient.get('/protected/notifications');
  return response.data.data;
};

export const getUnreadNotificationsCountApi = async () => {
  const response = await httpClient.get('/protected/notifications/unread-count');
  return response.data.data;
};

export const markNotificationAsReadApi = async (id: string) => {
  const response = await httpClient.put(`/protected/notifications/${id}/read`);
  return response.data.data;
};

export const markAllNotificationsAsReadApi = async () => {
  const response = await httpClient.put('/protected/notifications/read-all');
  return response.data.data;
};
