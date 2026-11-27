import React from 'react';
import { NAV_ITEMS } from '../../constants/nav.js';
import { handleWorkspaceLink, workspacePath } from '../../constants/workspaceRoutes';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  return (
    <nav aria-label="Workspace" className="mobile-bottom-nav" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '60px',
      background: 'var(--bg-card)',
      borderTop: '1px solid var(--border)',
      display: 'none', // Overridden by media query in index.css
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 100,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
      paddingBottom: 'safe-area-inset-bottom'
    }}>
      {NAV_ITEMS.map(item => {
        const isActive = activeTab === item.id;
        return (
          <a
            key={item.id}
            href={workspacePath(item.id)}
            aria-current={isActive ? 'page' : undefined}
            onClick={event => handleWorkspaceLink(event, () => setActiveTab(item.id))}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              flex: 1,
              height: '100%',
              background: 'transparent',
              border: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'color 0.15s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ 
              fontSize: '20px',
              fontWeight: isActive ? '700' : 'normal',
              transform: isActive ? 'scale(1.05)' : 'none',
              transition: 'transform 0.15s ease'
            }}>
              {item.icon}
            </span>
            <span style={{ 
              fontSize: '0.65rem', 
              fontWeight: isActive ? '700' : '500',
              letterSpacing: '0.01em'
            }}>
              {item.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
