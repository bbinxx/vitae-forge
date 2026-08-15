export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(endpoint, { ...options, headers });
    
    if (res.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
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
      return await res.json();
    }
    return res;
  } catch (err) {
    console.error('API Fetch Error:', err);
    throw err;
  }
}

// ── Resource Helper API Methods ────────────────────────────────────────────────

export const api = {
  // Applications
  getApplications: () => apiFetch('/applications'),
  getApplicationStats: () => apiFetch('/applications/stats/summary'),
  updateApplication: (id, data) => apiFetch(`/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteApplication: (id) => apiFetch(`/applications/${id}`, { method: 'DELETE' }),

  // Bookmarks (Saved Resumes)
  getBookmarks: () => apiFetch('/bookmarks'),
  createBookmark: (data) => apiFetch('/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
  updateBookmark: (id, data) => apiFetch(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBookmark: (id) => apiFetch(`/bookmarks/${id}`, { method: 'DELETE' }),

  // Settings & Config
  getSettings: () => apiFetch('/api/settings'),
  saveSettings: (data) => apiFetch('/api/settings', { method: 'POST', body: JSON.stringify(data) }),
  pickFolder: () => apiFetch('/api/settings/pick-folder'),
  getConfig: () => apiFetch('/get-config'),
  saveConfig: (data) => apiFetch('/save-config', { method: 'POST', body: JSON.stringify(data) }),
};
