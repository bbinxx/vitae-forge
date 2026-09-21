import React, { useState, useEffect } from 'react';
import { useApplications, applicationStore } from '../../stores/applicationStore';
import { settingsStore } from '../../stores/settingsStore';
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

  // Studio Modal States
  const [showStudioModal, setShowStudioModal] = useState(false);
  const [isCreatingNewApp, setIsCreatingNewApp] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  
  const [studioCompany, setStudioCompany] = useState('');
  const [studioRole, setStudioRole] = useState('');
  const [studioStatus, setStudioStatus] = useState('APPLIED');
  const [studioPriority, setStudioPriority] = useState('MEDIUM');

  const [jsonData, setJsonData] = useState<any>(null);
  const [previewType, setPreviewType] = useState<'resume' | 'cover_letter'>('resume');
  const [includePhoto, setIncludePhoto] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'editor' | 'preview'>('editor');
  const [savingConfig, setSavingConfig] = useState(false);

  // Studio PDF Settings modal states
  const [showStudioSettings, setShowStudioSettings] = useState(false);
  const [settingPrefix, setSettingPrefix] = useState('RESUME-');
  const [settingFolder, setSettingFolder] = useState('');

  useEffect(() => {
    loadApps();
  }, []);

  const handleOpenStudioSettings = async () => {
    try {
      await settingsStore.load();
      const s = settingsStore.getSettings();
      setSettingPrefix(s.file_name_prefix || 'RESUME-');
      setSettingFolder(s.export_folder || '');
    } catch {}
    setShowStudioSettings(true);
  };

  const handlePickFolder = async () => {
    try {
      const res = await apiFetch('/api/settings/pick-folder');
      const data = await res.json();
      if (data.folder) {
        setSettingFolder(data.folder);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveStudioSettings = async () => {
    try {
      const current = settingsStore.getSettings();
      await settingsStore.save({
        ...current,
        file_name_prefix: settingPrefix.trim(),
        export_folder: settingFolder.trim()
      });
      setShowStudioSettings(false);
      alert('PDF naming and export settings saved!');
    } catch (e: any) {
      alert('Failed to save settings: ' + e.message);
    }
  };

  const handleOpenNewAppStudio = async () => {
    setIsCreatingNewApp(true);
    setSelectedApp(null);
    setStudioCompany('');
    setStudioRole('');
    setStudioStatus('APPLIED');
    setStudioPriority('MEDIUM');
    setShowStudioModal(true);
    try {
      const configData = await api.getConfig();
      const mainData = configData.master || configData || {};
      setJsonData(mainData);
    } catch {
      setJsonData({});
    }
  };

  const handleOpenAppEditor = async (app: Application) => {
    setIsCreatingNewApp(false);
    setSelectedApp(app);
    setStudioCompany(app.company || '');
    setStudioRole(app.role || '');
    setStudioStatus(app.status || 'APPLIED');
    setStudioPriority(app.priority || 'MEDIUM');
    setShowStudioModal(true);
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
    const finalCompany = studioCompany.trim() || jsonData?.company || jsonData?.name || jsonData?.company_name || 'Untitled Company';
    const finalRole = studioRole.trim() || jsonData?.role || jsonData?.title || jsonData?.job_title || jsonData?.position || 'Untitled Role';

    setSavingConfig(true);
    try {
      if (isCreatingNewApp) {
        await applicationStore.createFromJson({
          company: finalCompany,
          role: finalRole,
          status: studioStatus,
          priority: studioPriority,
          resume_template: jsonData
        });
      } else if (selectedApp) {
        const updatedApp = {
          ...selectedApp,
          company: finalCompany,
          role: finalRole,
          status: studioStatus,
          priority: studioPriority,
          resume_template: jsonData
        };
        await api.updateApplication(selectedApp.id, updatedApp);
        await loadApps();
      }

      // Auto-export PDF copy to local settings location folder if set
      const settings = settingsStore.getSettings();
      if (settings && settings.export_folder) {
        const rawPrefix = (settings.file_name_prefix || 'RESUME').replace(/[-_\s]+$/, '');
        const parts = [rawPrefix, finalRole, finalCompany].filter(Boolean);
        const pdfName = parts.join('_')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .toUpperCase();

        api.exportPdfLocal(jsonData, pdfName, previewType, includePhoto).catch(err => {
          console.warn('Local export folder save notice:', err.message);
        });
      }

      setShowStudioModal(false);
      setSelectedApp(null);
    } catch (e: any) {
      alert('Failed to save application configuration: ' + e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenGmail = (app: Application) => {
    const appJson = app.resume_template || {};
    const company = app.company || appJson.company || appJson.company_name || 'Company';
    const role = app.role || appJson.role || appJson.title || appJson.position || 'Role';
    const contactName = appJson.contact_name || appJson.contactName || app.contact_name || '';
    const toEmail = appJson.email?.to || appJson.contact_email || appJson.to || app.contact_email || app.email?.to || '';
    const ccEmail = appJson.email?.cc || appJson.cc || app.email?.cc || '';
    const applicantName = appJson.personal?.name || appJson.applicant_name || 'Applicant';

    const defaultSubject = `Application for ${role} position - ${applicantName}`;
    const subject = appJson.email?.subject || appJson.subject || app.email?.subject || defaultSubject;

    const defaultBody = `Dear ${contactName ? contactName : 'Hiring Team'},\n\nI am writing to express my strong interest in the ${role} position at ${company}.\n\nMy resume is attached for your review. I would welcome the opportunity to discuss how my background and skills align with your team's needs.\n\nThank you for your time and consideration.\n\nBest regards,\n${applicantName}`;
    const body = appJson.email?.body || appJson.cover_letter?.text || appJson.cover_letter?.body || appJson.body || app.email?.body || defaultBody;

    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&cc=${encodeURIComponent(ccEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleOpenGmailInStudio = () => {
    const appJson = jsonData || selectedApp?.resume_template || {};
    const company = studioCompany || appJson.company || selectedApp?.company || 'Company';
    const role = studioRole || appJson.role || selectedApp?.role || 'Role';
    const contactName = appJson.contact_name || appJson.contactName || selectedApp?.contact_name || '';
    const toEmail = appJson.email?.to || appJson.contact_email || appJson.to || selectedApp?.contact_email || selectedApp?.email?.to || '';
    const ccEmail = appJson.email?.cc || appJson.cc || selectedApp?.email?.cc || '';
    const applicantName = appJson.personal?.name || appJson.applicant_name || 'Applicant';

    const defaultSubject = `Application for ${role} position - ${applicantName}`;
    const subject = appJson.email?.subject || appJson.subject || selectedApp?.email?.subject || defaultSubject;

    const coverText = appJson.cover_letter?.text || appJson.cover_letter?.body || appJson.email?.body || appJson.body;
    const defaultBody = `Dear ${contactName ? contactName : 'Hiring Team'},\n\nI am writing to express my strong interest in the ${role} position at ${company}.\n\nMy resume is attached for your review. I would welcome the opportunity to discuss how my background and skills align with your team's needs.\n\nThank you for your time and consideration.\n\nBest regards,\n${applicantName}`;
    const body = coverText || selectedApp?.email?.body || defaultBody;

    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&cc=${encodeURIComponent(ccEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this application?')) {
      await applicationStore.delete(id);
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
      const getAppTime = (app: Application) => {
        if (app.created_at) {
          const t = new Date(app.created_at).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        if (app.date_applied) {
          const t = new Date(app.date_applied).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        return 0;
      };
      result = getAppTime(a) - getAppTime(b);
      if (result === 0) {
        result = (a.created_at || a.id || '').localeCompare(b.created_at || b.id || '');
      }
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
        <button className="btn btn-primary" onClick={handleOpenNewAppStudio}>
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
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenGmail(app)} title="Open Gmail with pre-filled application details">
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>mail</span> Email
                      </button>
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
                <button className="btn btn-secondary btn-sm" onClick={() => handleOpenGmail(app)} title="Open Gmail">
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>mail</span> Email
                </button>
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

      {/* Full-screen Studio Modal */}
      {showStudioModal && jsonData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="studio-modal" style={{ background: 'var(--bg-base)', width: '96%', height: '94vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={studioCompany}
                    onChange={e => setStudioCompany(e.target.value)}
                    style={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      color: 'var(--text-main)',
                      minWidth: '180px'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Role Title"
                    value={studioRole}
                    onChange={e => setStudioRole(e.target.value)}
                    style={{
                      fontSize: '0.78rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      color: 'var(--text-muted)',
                      minWidth: '180px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select
                    className="input-field"
                    value={studioStatus}
                    onChange={e => setStudioStatus(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '3px 6px', height: 'auto', width: '110px' }}
                  >
                    <option value="APPLIED">Applied</option>
                    <option value="INTERVIEW">Interview</option>
                    <option value="OFFER">Offer</option>
                    <option value="REJECTED">Rejected</option>
                  </select>

                  <select
                    className="input-field"
                    value={studioPriority}
                    onChange={e => setStudioPriority(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '3px 6px', height: 'auto', width: '110px' }}
                  >
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>
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

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenGmailInStudio}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                  title="Open Gmail with pre-filled application details"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>mail</span> Open Gmail
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenStudioSettings}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                  title="Configure PDF Naming Prefix and Export Location"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>settings</span> PDF Settings
                </button>

                <button className="btn btn-ghost" onClick={() => { setShowStudioModal(false); setSelectedApp(null); }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
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
              <button className="btn btn-secondary" onClick={() => { setShowStudioModal(false); setSelectedApp(null); }}>Close Studio</button>
              <button className="btn btn-primary" onClick={handleSaveConfig} disabled={savingConfig}>
                {savingConfig ? (isCreatingNewApp ? 'Creating...' : 'Saving...') : (isCreatingNewApp ? 'Create Application' : 'Save Configuration')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Studio Settings Dialog Modal */}
      {showStudioSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '480px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)' }}>settings</span>
                PDF Naming & Export Settings
              </span>
              <button className="btn btn-ghost" onClick={() => setShowStudioSettings(false)} style={{ padding: '4px' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>File Name Prefix</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. RESUME- or Bibin_Raju-"
                  value={settingPrefix}
                  onChange={e => setSettingPrefix(e.target.value)}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Prefix used when generating and downloading PDF files.</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Export Destination Folder</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="/path/to/export/folder"
                    value={settingFolder}
                    onChange={e => setSettingFolder(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handlePickFolder}>
                    Pick...
                  </button>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Local folder path on system where PDFs are saved.</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowStudioSettings(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleSaveStudioSettings}>Save Settings</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
