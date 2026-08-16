import React, { useState, useEffect } from 'react';
import { useApplications } from '../../stores/applicationStore';
import { useResumes } from '../../stores/resumeStore';
import { useSettings } from '../../stores/settingsStore';
import { Application } from '../../types';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { apps, loading: loadingApps, loadApps } = useApplications();
  const { bookmarks, loading: loadingResumes, loadBookmarks } = useResumes();
  const { status, load: loadSettings } = useSettings();
  const [isStatusCollapsed, setIsStatusCollapsed] = useState(true);

  useEffect(() => {
    loadApps();
    loadBookmarks();
    loadSettings();
  }, []);

  const totalApps = apps.length;
  const activeApps = apps.filter(a => a.status !== 'REJECTED' && a.status !== 'OFFER').length;
  const totalResumes = bookmarks.length;
  const totalTemplates = 3; // Standard, Photo, Cover Letter
  const interviewsCount = apps.filter(a => a.status === 'INTERVIEW').length;
  const offersCount = apps.filter(a => a.status === 'OFFER').length;

  const recentApps = [...apps]
    .sort((a, b) => new Date(b.date_applied || b.created_at || 0).getTime() - new Date(a.date_applied || a.created_at || 0).getTime())
    .slice(0, 5);

  const getStatusBadgeStyle = (statusStr: string) => {
    const s = (statusStr || '').toUpperCase();
    if (s === 'OFFER') return { bg: 'rgba(5, 150, 105, 0.15)', color: 'var(--success)' };
    if (s === 'INTERVIEW') return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' };
    if (s === 'REJECTED') return { bg: 'rgba(220, 38, 38, 0.15)', color: 'var(--danger)' };
    return { bg: 'var(--accent-dim)', color: 'var(--accent)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Title Section */}
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Dashboard</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Monitor your pipeline, status values, and resume generation health.</p>
      </div>

      {/* ── METRICS GRID ── */}
      <div className="stat-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '12px'
      }}>
        {/* Metric Cards */}
        {[
          { label: 'Total Applications', val: totalApps, icon: 'work', trend: '+12% this month' },
          { label: 'Active Pipeline', val: activeApps, icon: 'hourglass_empty', trend: 'Steady' },
          { label: 'Saved Resumes', val: totalResumes, icon: 'bookmark', trend: '+2 new versions' },
          { label: 'LaTex Templates', val: totalTemplates, icon: 'auto_awesome_motion', trend: 'Up-to-date' },
          { label: 'Interviews Scheduled', val: interviewsCount, icon: 'forum', trend: '+1 upcoming' },
          { label: 'Offers Received', val: offersCount, icon: 'emoji_events', trend: 'New offer!' }
        ].map((item, idx) => (
          <div key={idx} style={{
            background: 'var(--bg-card)',
            padding: '16px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{item.label}</span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>{item.icon}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {loadingApps ? '...' : item.val}
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.trend}</span>
          </div>
        ))}
      </div>

      {/* ── PIPELINE FLOW DIAGRAM ── */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px'
      }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Application Pipeline Funnel
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '6px' }}>
          {[
            { label: 'Saved', count: bookmarks.length },
            { label: 'Applied', count: apps.filter(a => a.status === 'APPLIED').length },
            { label: 'Interview', count: interviewsCount },
            { label: 'Offer', count: offersCount },
            { label: 'Rejected', count: apps.filter(a => a.status === 'REJECTED').length }
          ].map((step, idx, arr) => (
            <React.Fragment key={idx}>
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 12px',
                minWidth: '100px',
                textAlign: 'center',
                flex: 1
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{step.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{step.count}</div>
              </div>
              {idx < arr.length - 1 && (
                <span className="material-symbols-outlined" style={{ color: 'var(--border)', fontSize: '18px' }}>arrow_forward</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── TWO COLUMN MAIN LAYOUT ── */}
      <div className="stat-grid" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '20px'
      }}>
        {/* Left Column: Recent Applications */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Recent Applications</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('applications')} style={{ color: 'var(--accent)' }}>
              View All
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentApps.map((app) => {
              const badge = getStatusBadgeStyle(app.status);
              return (
                <div key={app.id} style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{app.company}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.role}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      background: badge.bg,
                      color: badge.color
                    }}>
                      {app.status || 'APPLIED'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{app.date_applied}</span>
                  </div>
                </div>
              );
            })}
            {recentApps.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No job applications recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Actions & Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Actions Grid */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Quick Tasks</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => onNavigate('applications')} style={{ justifyContent: 'flex-start' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span> Add Application
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate('saved-resumes')} style={{ justifyContent: 'flex-start' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>post_add</span> Create New Resume
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate('templates')} style={{ justifyContent: 'flex-start' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>settings_ethernet</span> Manage Templates
              </button>
            </div>
          </div>

          {/* Collapsible System status card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setIsStatusCollapsed(!isStatusCollapsed)}
            >
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>System Diagnostics</span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
                {isStatusCollapsed ? 'expand_more' : 'expand_less'}
              </span>
            </div>

            {!isStatusCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>FastAPI Port 5050</span>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>ONLINE</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>LaTeX pdflatex</span>
                  <span style={{ color: status.latex_ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {status.latex_ok ? 'AVAILABLE' : 'MISSING'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PDF Compilation</span>
                  <span style={{ color: status.server_ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>READY</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>App Version</span>
                  <span>{status.version || 'v1.1.0'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
