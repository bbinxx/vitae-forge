import { Application, Bookmark, Setting, Recipe } from '../types';

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(!(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(endpoint, { ...options, headers });
    
    if (res.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.detail || `HTTP Error ${res.status}`;
      throw new Error(msg);
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json() as T;
    }
    return res as unknown as T;
  } catch (err: any) {
    console.error('API Fetch Error:', err);
    throw err;
  }
}

// ── Typed API Endpoints ──
export const api = {
  // Applications
  getApplications: () => apiFetch<{ applications: Application[] }>('/applications'),
  getApplicationStats: () => apiFetch<any>('/applications/stats/summary'),
  createApplication: (data: Omit<Application, 'id'>) => apiFetch<{ application: Application }>('/applications', { method: 'POST', body: JSON.stringify(data) }),
  updateApplication: (id: string, data: Partial<Application>) => apiFetch<{ application: Application }>(`/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteApplication: (id: string) => apiFetch<{ ok: boolean }>(`/applications/${id}`, { method: 'DELETE' }),

  // Bookmarks (Saved Resumes)
  getBookmarks: () => apiFetch<{ bookmarks: Bookmark[] }>('/bookmarks'),
  createBookmark: (data: { name: string; data: any; source_app_id?: string }) => apiFetch<{ bookmark: Bookmark }>('/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
  updateBookmark: (id: string, data: Partial<Bookmark>) => apiFetch<{ bookmark: Bookmark }>(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBookmark: (id: string) => apiFetch<{ ok: boolean }>(`/bookmarks/${id}`, { method: 'DELETE' }),

  // Settings & Config
  getSettings: () => apiFetch<Setting>('/api/settings'),
  saveSettings: (data: Setting) => apiFetch<{ ok: boolean }>('/api/settings', { method: 'POST', body: JSON.stringify(data) }),
  pickFolder: () => apiFetch<{ folder: string }>('/api/settings/pick-folder'),
  getConfig: () => apiFetch<any>('/get-config'),
  saveConfig: (data: any) => apiFetch<{ ok: boolean }>('/save-config', { method: 'POST', body: JSON.stringify(data) }),
  uploadSettingsPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ ok: boolean; photo_r2_key: string }>('/api/settings/photo', {
      method: 'POST',
      body: formData
    });
  },
  getSettingsPhotoUrl: () => apiFetch<{ url: string | null }>('/api/settings/photo-url'),

  // LaTeX Templates
  getTemplate: (filename: string) => apiFetch<{ content: string; filename: string }>(`/api/template/${filename}`),
  saveTemplate: (filename: string, content: string) => apiFetch<{ ok: boolean; filename: string }>(`/api/template/${filename}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  }),
};
