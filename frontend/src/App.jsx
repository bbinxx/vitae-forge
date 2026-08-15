import React, { useState } from 'react';
import Navbar from './components/Navbar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ApplicationsPage from './pages/ApplicationsPage.jsx';
import SavedResumesPage from './pages/SavedResumesPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleSignOut = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

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
