import React from 'react';
import Header from '../navigation/Header';
import BottomNav from '../navigation/BottomNav';
import { User } from '../../types';

interface ShellProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onSignOut: () => void;
  children: React.ReactNode;
}

export default function Shell({ activeTab, setActiveTab, user, onSignOut, children }: ShellProps) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Desktop Navigation */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} user={user} onSignOut={onSignOut} />

      {/* Mobile Top Header (Hidden on Desktop) */}
      <header className="mobile-only" style={{
        height: '56px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        display: 'none', // Overridden by media query in index.css
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '24px', 
            height: '24px', 
            borderRadius: '5px', 
            background: 'var(--accent)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#ffffff' }}>description</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Vitae Forge</span>
        </div>
        
        <button
          onClick={onSignOut}
          style={{ background: 'transparent', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', padding: '6px', cursor: 'pointer' }}
          title="Sign Out"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
