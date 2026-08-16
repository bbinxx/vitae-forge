import React from 'react';
import { NAV_ITEMS } from '../../constants/nav.js';
import { User } from '../../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onSignOut: () => void;
}

export default function Header({ activeTab, setActiveTab, user, onSignOut }: HeaderProps) {
  const username = user?.username || 'User';

  return (
    <header className="desktop-nav" style={{
      height: '56px',
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      flexShrink: 0
    }}>
      {/* Brand Logo & Name */}
      <div 
        className="header-brand" 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} 
        onClick={() => setActiveTab('dashboard')}
      >
        <div style={{ 
          width: '28px', 
          height: '28px', 
          borderRadius: '6px', 
          background: 'var(--accent)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ffffff' }}>description</span>
        </div>
        <span className="brand-name" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          Vitae Forge
        </span>
      </div>

      {/* Nav Links */}
      <nav style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === item.id ? 'var(--accent-dim)' : 'transparent',
              color: activeTab === item.id ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Top Header Actions (User Badge & Logout) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="user-badge" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          padding: '3px 8px', 
          borderRadius: '20px', 
          background: 'var(--bg-surface)', 
          border: '1px solid var(--border)' 
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--accent)' }}>account_circle</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{username}</span>
        </div>

        <button
          className="btn btn-ghost btn-sm header-logout-btn"
          style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px' }}
          onClick={onSignOut}
          title="Sign Out"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
          <span className="logout-text">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
