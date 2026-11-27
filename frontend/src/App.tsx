import React, { lazy, Suspense, useState, useEffect } from 'react';
import Shell from './components/layout/Shell';
import ApplicationsPage from './pages/Applications/ApplicationsPage';
import LoginPage from './pages/LoginPage';
import LoadingState from './components/common/LoadingState';
import { applicationStore } from './stores/applicationStore';
import { resumeStore } from './stores/resumeStore';
import { apiFetch, clearStoredSession } from './services/api';
import { settingsStore } from './stores/settingsStore';
import { User } from './types';
import { workspacePath, workspaceReturnPath, workspaceTab } from './constants/workspaceRoutes';

const SavedResumesPage = lazy(() => import('./pages/Resumes/SavedResumesPage'));
const TemplatesPage = lazy(() => import('./pages/Templates/TemplatesPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));

export default function App() {
  const [activeTab, setActiveTab] = useState(() => workspaceTab(window.location.pathname));
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

  const [isLoginPage, setIsLoginPage] = useState(() => window.location.pathname === '/login');

  useEffect(() => {
    localStorage.removeItem('token');
    if (!isLoginPage) void checkSession();
  }, []);

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const applyAppearance = () => {
      const { theme, density } = settingsStore.getSettings();
      const dark = theme === 'dark' || (theme !== 'light' && colorScheme.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.dataset.density = density === 'compact' ? 'compact' : 'comfortable';
    };
    const unsubscribe = settingsStore.subscribe(applyAppearance);
    colorScheme.addEventListener('change', applyAppearance);
    applyAppearance();
    return () => {
      unsubscribe();
      colorScheme.removeEventListener('change', applyAppearance);
    };
  }, []);

  useEffect(() => {
    const syncLocation = () => setActiveTab(workspaceTab(window.location.pathname));
    const revalidateRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('popstate', syncLocation);
    window.addEventListener('pageshow', revalidateRestoredPage);
    return () => {
      window.removeEventListener('popstate', syncLocation);
      window.removeEventListener('pageshow', revalidateRestoredPage);
    };
  }, []);

  useEffect(() => {
    if (isLoginPage || !user?.id) return;
    const handleAccountChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== 'user' && event.key !== null)) return;
      try {
        if (event.newValue && JSON.parse(event.newValue)?.id === user.id) return;
      } catch {
        // Invalid session metadata must be checked again.
      }
      window.location.reload();
    };
    window.addEventListener('storage', handleAccountChange);
    return () => window.removeEventListener('storage', handleAccountChange);
  }, [isLoginPage, user?.id]);

  const navigateWorkspace = (tab: string) => {
    const path = workspacePath(tab);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setActiveTab(workspaceTab(path));
  };

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
      if (window.location.pathname === '/') window.history.replaceState(null, '', workspacePath(activeTab));
      setSessionChecked(true);
      void settingsStore.load();
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
    clearStoredSession();
    applicationStore.reset();
    resumeStore.reset();
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    const target = workspaceReturnPath(new URLSearchParams(window.location.search).get('next'));
    window.history.replaceState(null, '', target);
    setActiveTab(workspaceTab(target));
    setSessionChecked(true);
    setIsLoginPage(false);
    void settingsStore.load();
  };

  if (isLoginPage) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (!sessionChecked) {
    return sessionError
      ? <p role="alert">{sessionError} <button onClick={checkSession}>Retry</button></p>
      : <div className="session-loading"><LoadingState label="Checking your session…" skeleton /></div>;
  }

  return (
    <Shell activeTab={activeTab} setActiveTab={navigateWorkspace} user={user} onSignOut={handleSignOut}>
      {sessionError && <p role="alert">{sessionError}</p>}
      {(activeTab === 'applications') && <ApplicationsPage />}
      <Suspense fallback={<LoadingState label="Opening workspace screen…" skeleton />}>
        {activeTab === 'saved-resumes' && <SavedResumesPage />}
        {activeTab === 'templates' && <TemplatesPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </Suspense>
    </Shell>
  );
}
