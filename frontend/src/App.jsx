import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ApplicationsPage from './pages/ApplicationsPage.jsx';
import SavedResumesPage from './pages/SavedResumesPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { apiFetch } from './services/api.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(() => {
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
      const userData = await apiFetch('/api/auth/me');
      if (userData && userData.username) {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (e) {
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

  const handleLoginSuccess = (loggedInUser) => {
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onSignOut={handleSignOut} />
      
      <main className="main-content" style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} />}
        {activeTab === 'applications' && <ApplicationsPage />}
        {activeTab === 'saved-resumes' && <SavedResumesPage />}
        {activeTab === 'templates' && <TemplatesPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
