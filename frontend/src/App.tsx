import React, { lazy, Suspense, useState, useEffect } from 'react';
import Shell from './components/layout/Shell';
import ApplicationsPage from './pages/Applications/ApplicationsPage';
import LoginPage from './pages/LoginPage';
import { apiFetch } from './services/api';
import { User } from './types';

const SavedResumesPage = lazy(() => import('./pages/Resumes/SavedResumesPage'));
const TemplatesPage = lazy(() => import('./pages/Templates/TemplatesPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));

export default function App() {
  const [activeTab, setActiveTab] = useState('applications');
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cachedUser = localStorage.getItem('user');
      return cachedUser ? JSON.parse(cachedUser) : null;
    } catch {
      return null;
    }
  });

  const isLoginPage = window.location.pathname === '/login';

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const userData = await apiFetch<User>('/api/auth/me');
      if (userData && userData.username) {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (e: any) {
      console.log('Session check notice:', e.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => ({}));
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('cached_applications');
      localStorage.removeItem('cached_bookmarks');
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.href = '/login';
    }
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    if (loggedInUser) {
      setUser(loggedInUser);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
    }
    window.location.href = '/';
  };

  if (isLoginPage) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Shell activeTab={activeTab === 'dashboard' ? 'applications' : activeTab} setActiveTab={setActiveTab} user={user} onSignOut={handleSignOut}>
      {(activeTab === 'dashboard' || activeTab === 'applications') && <ApplicationsPage />}
      <Suspense fallback={<p role="status">Loading…</p>}>
        {activeTab === 'saved-resumes' && <SavedResumesPage />}
        {activeTab === 'templates' && <TemplatesPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </Suspense>
    </Shell>
  );
}
