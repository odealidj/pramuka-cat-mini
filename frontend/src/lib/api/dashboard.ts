import httpClient from '../http-client';

export interface DashboardStats {
  total_participants: number;
  total_questions: number;
  active_events: number;
  completed_exams: number;
}

export interface DashboardActivity {
  name: string;
  photo_url?: string;
  action: string;
  time: string;
  status: 'pending' | 'approved' | 'completed' | 'expired' | 'revoked';
  event_end_time: string;
}

export interface DashboardData {
  stats: DashboardStats;
  activities: DashboardActivity[];
}

export interface DashboardResponse {
  message: string;
  data: DashboardData;
}

export interface ActivityListResponse {
  message: string;
  data: {
    data: DashboardActivity[];
    total_items: number;
    total_pages: number;
    page: number;
    limit: number;
  };
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardResponse> => {
    const response = await httpClient.get('/admin/dashboard/stats');
    return response.data;
  },
  getActivities: async (page: number = 1, limit: number = 10): Promise<ActivityListResponse> => {
    const response = await httpClient.get(`/admin/dashboard/activities?page=${page}&limit=${limit}`);
    return response.data;
  },
};
