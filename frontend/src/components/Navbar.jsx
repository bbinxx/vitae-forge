import React from 'react';
import { NAV_ITEMS } from '../constants/nav.js';

export default function Navbar({ activeTab, setActiveTab, user, onSignOut }) {
  const username = user?.username || 'User';

  return (
    <header className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '60px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
      <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ffffff' }}>description</span>
        </div>
        <span className="brand-name" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Vitae Forge</span>
      </div>

      <nav className="header-nav" style={{ display: 'flex', gap: '4px' }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === item.id ? 'var(--accent-dim)' : 'transparent',
              color: activeTab === item.id ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>account_circle</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{username}</span>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={onSignOut}
          title="Sign out of your session"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
