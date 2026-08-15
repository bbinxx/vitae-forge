import React, { useState } from 'react';
import Navbar from './components/Navbar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ApplicationsPage from './pages/ApplicationsPage.jsx';
import SavedResumesPage from './pages/SavedResumesPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const isLoginPage = window.location.pathname === '/login';

  const handleSignOut = () => {
    localStorage.removeItem('token');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/login';
  };

  if (isLoginPage) {
    return <LoginPage onLoginSuccess={() => { window.location.href = '/'; }} />;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} onSignOut={handleSignOut} />
      
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
