import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.js';

export default function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState({ total: 0, by_status: {}, by_priority: {} });
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [statsData, bookmarksData] = await Promise.all([
          apiFetch('/applications/stats/summary').catch(() => ({ total: 0, by_status: {}, by_priority: {} })),
          apiFetch('/bookmarks').catch(() => ({ bookmarks: [] }))
        ]);
        setStats(statsData);
        setBookmarksCount((bookmarksData.bookmarks || []).length);
      } catch (err) {
        console.error('Failed to load dashboard statistics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Dashboard Overview</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Welcome to Resume Studio. Monitor application metrics and quick actions.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div 
          onClick={() => onNavigate('applications')}
          style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)' }}>work</span> Total Applications
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
            {loading ? '...' : stats.total || 0}
          </div>
        </div>

        <div 
          onClick={() => onNavigate('saved-resumes')}
          style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)' }}>bookmark</span> Saved Resumes
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
            {loading ? '...' : bookmarksCount}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--success)' }}>dns</span> Backend Server
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--success)', marginTop: '12px' }}>
            FastAPI (Port 5050)
          </div>
        </div>
      </div>
    </div>
  );
}
