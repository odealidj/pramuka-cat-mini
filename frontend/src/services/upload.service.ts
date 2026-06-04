import axios from 'axios';
import { getInMemoryToken } from '@/lib/http-client';
import { API_BASE_URL } from '@/lib/constants';

export interface UploadImageResponse {
  message: string;
  data: {
    url: string;
  };
}

export async function uploadImageApi(file: File): Promise<string> {
  const formData = new FormData();
  // We let Axios handle the boundary automatically. Also add a default filename.
  formData.append('file', file, file.name || 'image.webp');

  const response = await axios.post<UploadImageResponse>(
    `${API_BASE_URL}/upload/image`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${getInMemoryToken()}`,
      },
    }
  );

  return response.data.data.url;
}
