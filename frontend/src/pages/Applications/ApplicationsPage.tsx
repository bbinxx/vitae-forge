import React, { useState, useEffect } from 'react';
import { useApplications, applicationStore } from '../../stores/applicationStore';
import { api, apiFetch } from '../../services/api';
import { Application } from '../../types';
import JsonEditor from '../../components/common/JsonEditor';
import LivePdfPreview from '../../components/common/LivePdfPreview';
import SectionToggleBar from '../../components/SectionToggleBar';

export default function ApplicationsPage() {
  const { apps, loading, loadApps } = useApplications();
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Bulk actions selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Editor
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newStatus, setNewStatus] = useState('APPLIED');
  const [newPriority, setNewPriority] = useState('MEDIUM');

  // Resume Studio states
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [jsonData, setJsonData] = useState<any>(null);
  const [previewType, setPreviewType] = useState<'resume' | 'cover_letter'>('resume');
  const [includePhoto, setIncludePhoto] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<'editor' | 'preview'>('editor');
  const [savingConfig, setSavingConfig] = useState(false);

  // Row actions context menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim() || !newRole.trim()) return;
    await applicationStore.create(newCompany.trim(), newRole.trim(), newStatus, newPriority);
    setNewCompany('');
    setNewRole('');
    setNewStatus('APPLIED');
    setNewPriority('MEDIUM');
    setShowCreateModal(false);
  };

  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this application?')) {
      await applicationStore.delete(id);
    }
  };

  const handleOpenAppEditor = async (app: Application) => {
    setSelectedApp(app);
    // Config fetching
    try {
      if (app.resume_template) {
        setJsonData(app.resume_template);
      } else {
        const configData = await api.getConfig();
        const mainData = configData.master || configData || {};
        setJsonData(mainData);
      }
    } catch {
      setJsonData({});
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedApp) return;
    setSavingConfig(true);
    try {
      const updatedApp = { ...selectedApp, resume_template: jsonData };
      await api.updateApplication(selectedApp.id, updatedApp);
      await loadApps();
      alert('Application resume configuration saved successfully!');
    } catch (e: any) {
      alert('Failed to save configuration: ' + e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleSection = (sectionName: string) => {
    if (!jsonData) return;
    const sections = { ...(jsonData.sections || {}) };
    sections[sectionName] = !sections[sectionName];
    setJsonData({ ...jsonData, sections });
  };

  // Bulk actions triggers
  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected applications?`)) {
      await applicationStore.bulkDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    await applicationStore.bulkStatusUpdate(selectedIds, status);
    setSelectedIds([]);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredApps.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Filtering & Sorting
  const filteredApps = apps.filter(app => {
    const text = (filterText || '').toLowerCase();
    const matchesText = 
      (app.company || '').toLowerCase().includes(text) ||
      (app.role || '').toLowerCase().includes(text);
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || app.priority === priorityFilter;
    return matchesText && matchesStatus && matchesPriority;
  });

  const sortedApps = [...filteredApps].sort((a, b) => {
    let result = 0;
    if (sortField === 'company') {
      result = (a.company || '').localeCompare(b.company || '');
    } else if (sortField === 'role') {
      result = (a.role || '').localeCompare(b.role || '');
    } else if (sortField === 'date') {
      result = new Date(a.date_applied || 0).getTime() - new Date(b.date_applied || 0).getTime();
    }
    return sortOrder === 'asc' ? result : -result;
  });

  const getStatusBadgeColor = (statusStr: string) => {
    const s = (statusStr || '').toUpperCase();
    if (s === 'OFFER') return { bg: 'rgba(5, 150, 105, 0.15)', color: 'var(--success)' };
    if (s === 'INTERVIEW') return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' };
    if (s === 'REJECTED') return { bg: 'rgba(220, 38, 38, 0.15)', color: 'var(--danger)' };
    return { bg: 'var(--accent-dim)', color: 'var(--accent)' };
  };

  const getPriorityColor = (p: string) => {
    const pv = (p || '').toUpperCase();
    if (pv === 'HIGH') return 'var(--danger)';
    if (pv === 'LOW') return 'var(--text-muted)';
    return 'var(--warning)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Job Applications</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Track positions and configure tailored versions of your resume.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span> Add Application
        </button>
      </div>

      {/* Control Bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '12px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)'
      }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search by company or role..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ flex: 1, minWidth: '160px', maxWidth: '240px' }}
        />

        <select
          className="input-field"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '120px' }}
        >
          <option value="ALL">All Status</option>
          <option value="APPLIED">Applied</option>
          <option value="INTERVIEW">Interview</option>
          <option value="OFFER">Offer</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select
          className="input-field"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{ width: '120px' }}
        >
          <option value="ALL">All Priority</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          className="input-field"
          value={`${sortField}-${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split('-');
            setSortField(field);
            setSortOrder(order as any);
          }}
          style={{ width: '140px' }}
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="company-asc">Company A-Z</option>
          <option value="company-desc">Company Z-A</option>
        </select>

        {/* Bulk action buttons */}
        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '4px' }}>
              {selectedIds.length} selected
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkStatusChange('INTERVIEW')}>
              Interview
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkStatusChange('OFFER')}>
              Offer
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* ── DESKTOP: Table View ── */}
      <div className="app-table-wrapper" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', width: '4%' }}>
                <input 
                  type="checkbox" 
                  onChange={handleSelectAll}
                  checked={filteredApps.length > 0 && selectedIds.length === filteredApps.length}
                />
              </th>
              <th style={{ padding: '12px 16px', width: '22%' }}>Company</th>
              <th style={{ padding: '12px 16px', width: '26%' }}>Role</th>
              <th style={{ padding: '12px 16px', width: '14%' }}>Status</th>
              <th style={{ padding: '12px 16px', width: '12%' }}>Priority</th>
              <th style={{ padding: '12px 16px', width: '12%' }}>Applied Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', width: '10%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedApps.map((app) => {
              const badge = getStatusBadgeColor(app.status);
              const isSelected = selectedIds.includes(app.id);
              return (
                <tr key={app.id} style={{ borderBottom: '1px solid var(--border-soft)', background: isSelected ? 'var(--bg-hover)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => handleToggleSelect(app.id)}
                    />
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{app.company}</td>
                  <td style={{ padding: '12px 16px' }}>{app.role}</td>
                  <td style={{ padding: '12px 16px' }}>
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
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: getPriorityColor(app.priority) }}>
                    {app.priority || 'MEDIUM'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{app.date_applied}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenAppEditor(app)}>
                        Open Studio
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={(e) => handleDeleteApp(app.id, e)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE: Card Grid View ── */}
      <div className="app-cards-wrapper">
        {sortedApps.map((app) => {
          const badge = getStatusBadgeColor(app.status);
          return (
            <div key={app.id} className="app-card">
              <div className="app-card-row">
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{app.company}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{app.role}</div>
                </div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  background: badge.bg,
                  color: badge.color
                }}>
                  {app.status || 'APPLIED'}
                </span>
              </div>
              <div className="app-card-row" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Priority: <strong style={{ color: getPriorityColor(app.priority) }}>{app.priority || 'MEDIUM'}</strong></span>
                <span>{app.date_applied}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleOpenAppEditor(app)}>
                  Open Studio
                </button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={(e) => handleDeleteApp(app.id, e)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Application Dialog Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '440px', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Create Job Tracker Entry</span>
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)} style={{ padding: '4px' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateApp} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Company</label>
                <input type="text" className="input-field" value={newCompany} onChange={e => setNewCompany(e.target.value)} required placeholder="e.g. OpenAI" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Role</label>
                <input type="text" className="input-field" value={newRole} onChange={e => setNewRole(e.target.value)} required placeholder="e.g. Full Stack Architect" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Status</label>
                <select className="input-field" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="APPLIED">Applied</option>
                  <option value="INTERVIEW">Interview</option>
                  <option value="OFFER">Offer</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Priority</label>
                <select className="input-field" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Job</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-screen Studio Modal */}
      {selectedApp && jsonData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="studio-modal" style={{ background: 'var(--bg-base)', width: '96%', height: '94vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{selectedApp.company}</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedApp.role}</p>
              </div>

              {/* Mobile tabs switch buttons */}
              <div className="mobile-only" style={{ gap: '4px', background: 'var(--bg-surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <button className={`btn btn-sm ${activeMobileTab === 'editor' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveMobileTab('editor')}>
                  Editor
                </button>
                <button className={`btn btn-sm ${activeMobileTab === 'preview' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveMobileTab('preview')}>
                  Preview
                </button>
              </div>

              <button className="btn btn-ghost" onClick={() => setSelectedApp(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="studio-grid" style={{ overflowY: 'auto' }}>
              {/* Json Editor Pane */}
              <div className={`editor-pane ${activeMobileTab === 'preview' ? 'hidden-mobile' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '300px', flex: 1, height: '100%' }}>
                <SectionToggleBar sections={jsonData.sections} onToggleSection={handleToggleSection} />
                <div style={{ flex: 1, position: 'relative', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', minHeight: '260px' }}>
                  <JsonEditor value={jsonData} onChange={setJsonData} />
                </div>
              </div>

              {/* Preview Pane */}
              <div className={`preview-pane ${activeMobileTab === 'editor' ? 'hidden-mobile' : ''}`} style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
                <LivePdfPreview
                  jsonPayload={jsonData}
                  previewType={previewType}
                  includePhoto={includePhoto}
                  onToggleType={setPreviewType}
                  onTogglePhoto={setIncludePhoto}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-card)', flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => setSelectedApp(null)}>Close Studio</button>
              <button className="btn btn-primary" onClick={handleSaveConfig} disabled={savingConfig}>
                {savingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
