import React, { useState, useEffect } from 'react';
import Shell from './components/layout/Shell';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ApplicationsPage from './pages/Applications/ApplicationsPage';
import SavedResumesPage from './pages/Resumes/SavedResumesPage';
import TemplatesPage from './pages/Templates/TemplatesPage';
import SettingsPage from './pages/Settings/SettingsPage';
import LoginPage from './pages/LoginPage';
import { apiFetch } from './services/api';
import { User } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
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
    <Shell activeTab={activeTab} setActiveTab={setActiveTab} user={user} onSignOut={handleSignOut}>
      {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} />}
      {activeTab === 'applications' && <ApplicationsPage />}
      {activeTab === 'saved-resumes' && <SavedResumesPage />}
      {activeTab === 'templates' && <TemplatesPage />}
      {activeTab === 'settings' && <SettingsPage />}
    </Shell>
  );
}
