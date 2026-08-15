import React from 'react';
import { NAV_ITEMS } from '../constants/nav.js';

export default function Navbar({ activeTab, setActiveTab, onSignOut }) {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="material-symbols-outlined brand-icon">description</span>
        <span className="brand-name">Resume Studio</span>
      </div>
      <nav className="header-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={onSignOut}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: '-2px' }}>logout</span> Sign Out
        </button>
      </div>
    </header>
  );
}
