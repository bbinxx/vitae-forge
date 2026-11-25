import React, { lazy, Suspense, useState, useEffect } from 'react';
import Shell from './components/layout/Shell';
import ApplicationsPage from './pages/Applications/ApplicationsPage';
import LoginPage from './pages/LoginPage';
import { apiFetch, clearStoredSession } from './services/api';
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
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const isLoginPage = window.location.pathname === '/login';

  useEffect(() => {
    localStorage.removeItem('token');
    if (!isLoginPage) void checkSession();
  }, []);

  const checkSession = async () => {
    setSessionError('');
    try {
      const userData = await apiFetch<User>('/api/auth/me');
      if (userData.id !== user?.id &&
          (localStorage.getItem('cached_applications') || localStorage.getItem('cached_bookmarks'))) {
        clearStoredSession();
        localStorage.setItem('user', JSON.stringify(userData));
        window.location.reload();
        return;
      }
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      setSessionChecked(true);
    } catch {
      setSessionError('Could not verify your session.');
    }
  };

  const handleSignOut = async () => {
    setSessionError('');
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      clearStoredSession();
      window.location.href = '/login';
    } catch {
      setSessionError('Sign-out failed. Please try again.');
    }
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    if (loggedInUser) {
      clearStoredSession();
      setUser(loggedInUser);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
    }
    window.location.href = '/';
  };

  if (isLoginPage) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (!sessionChecked) {
    return sessionError
      ? <p role="alert">{sessionError} <button onClick={checkSession}>Retry</button></p>
      : <p role="status">Checking session…</p>;
  }

  return (
    <Shell activeTab={activeTab === 'dashboard' ? 'applications' : activeTab} setActiveTab={setActiveTab} user={user} onSignOut={handleSignOut}>
      {sessionError && <p role="alert">{sessionError}</p>}
      {(activeTab === 'dashboard' || activeTab === 'applications') && <ApplicationsPage />}
      <Suspense fallback={<p role="status">Loading…</p>}>
        {activeTab === 'saved-resumes' && <SavedResumesPage />}
        {activeTab === 'templates' && <TemplatesPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </Suspense>
    </Shell>
  );
}
