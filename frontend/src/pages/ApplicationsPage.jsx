import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.js';
import SectionToggleBar from '../components/SectionToggleBar.jsx';
import LivePdfPreview from '../components/common/LivePdfPreview.jsx';
import JsonEditor from '../components/common/JsonEditor.jsx';

export default function ApplicationsPage() {
  const [applications, setApplications] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_applications');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedApp, setSelectedApp] = useState(null);
  const [jsonData, setJsonData] = useState({});
  const [previewType, setPreviewType] = useState('resume');
  const [includePhoto, setIncludePhoto] = useState(true);

  // Modal State for New Application Creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newStatus, setNewStatus] = useState('APPLIED');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const data = await apiFetch('/applications');
      const list = data.applications || data || [];
      setApplications(list);
      localStorage.setItem('cached_applications', JSON.stringify(list));
    } catch (e) {
      console.error('Failed to load applications:', e);
    }
  };

  const handleCreateApp = async () => {
    if (!newCompany.trim() || !newRole.trim()) return;
    try {
      const configRes = await apiFetch('/get-config').catch(() => ({}));
      const baseConfig = configRes.master || configRes || {};

      const created = await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({
          company: newCompany.trim(),
          role: newRole.trim(),
          status: newStatus,
          date_applied: new Date().toISOString().split('T')[0],
          resume_template: baseConfig,
        }),
      });

      setShowCreateModal(false);
      setNewCompany('');
      setNewRole('');
      loadApplications();
      if (created.application) openAppEditor(created.application);
    } catch (e) {
      alert('Failed to create application: ' + e.message);
    }
  };

  const handleDeleteApp = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
      await apiFetch(`/applications/${id}`, { method: 'DELETE' });
      loadApplications();
    } catch (e) {
      alert('Failed to delete application: ' + e.message);
    }
  };

  const openAppEditor = (app) => {
    setSelectedApp(app);
    const data = app.resume_template || app;
    setJsonData(data);
    setIncludePhoto(app.include_photo !== false);
  };

  const handleToggleSection = (secKey) => {
    setJsonData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (!copy.sections) copy.sections = {};
      copy.sections[secKey] = copy.sections[secKey] === false;
      return copy;
    });
  };

  const handleSaveApp = async () => {
    if (!selectedApp || !selectedApp.id) return;
    try {
      await apiFetch(`/applications/${selectedApp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...selectedApp, resume_template: jsonData, include_photo: includePhoto }),
      });
      alert('Application updated successfully!');
      loadApplications();
    } catch (e) {
      alert('Failed to save application: ' + e.message);
    }
  };

  const handleBookmarkToSavedResumes = async () => {
    try {
      const company = jsonData.company || selectedApp?.company || 'Application';
      const role = jsonData.role || selectedApp?.role || 'Resume';
      const name = `${company} - ${role}`;

      await apiFetch('/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ name, data: jsonData, source_app_id: selectedApp?.id || '' }),
      });
      alert(`"${name}" saved to Saved Resumes!`);
    } catch (e) {
      alert('Error bookmarking resume: ' + e.message);
    }
  };

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      (app.company || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (app.role || '').toLowerCase().includes(filterText.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (app.status || '').toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Job Applications Control Center</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Track, manage, and customize tailored resumes for every application.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search company or role..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ width: '200px' }}
          />
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '130px', padding: '6px' }}
          >
            <option value="ALL">All Status</option>
            <option value="APPLIED">Applied</option>
            <option value="INTERVIEW">Interview</option>
            <option value="OFFER">Offer</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>add</span> Add Application
          </button>
        </div>
      </div>

      {/* Applications Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Company</th>
              <th style={{ padding: '12px 16px' }}>Role</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Applied Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredApps.map((app) => (
              <tr key={app.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{app.company}</td>
                <td style={{ padding: '12px 16px' }}>{app.role}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                    {app.status || 'APPLIED'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{app.date_applied || 'Recent'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openAppEditor(app)}>
                      Open Studio
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={(e) => handleDeleteApp(app.id, e)}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredApps.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No applications found. Click <strong>"Add Application"</strong> to create your first track entry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Application Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Create New Job Application</h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Company Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Google"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Job Role / Title</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Senior Backend Engineer"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Application Status</label>
              <select className="input-field" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="APPLIED">Applied</option>
                <option value="INTERVIEW">Interview</option>
                <option value="OFFER">Offer</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateApp}>Create Application</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {selectedApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', width: '94%', height: '90vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{selectedApp.company} — {selectedApp.role}</h3>
              <button className="btn btn-ghost" onClick={() => setSelectedApp(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1, padding: '16px', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, flex: 1 }}>
                <SectionToggleBar sections={jsonData.sections} onToggleSection={handleToggleSection} />
                <div style={{ flex: 1, minHeight: 0, position: 'relative', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                  <JsonEditor value={jsonData} onChange={setJsonData} />
                </div>
              </div>

              <LivePdfPreview
                jsonPayload={jsonData}
                previewType={previewType}
                includePhoto={includePhoto}
                onToggleType={setPreviewType}
                onTogglePhoto={setIncludePhoto}
              />
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={handleBookmarkToSavedResumes} title="Bookmark this application resume into Saved Resumes library">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>bookmark_add</span> Save to Saved Resumes
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedApp(null)}>Close</button>
                <button className="btn btn-primary" onClick={handleSaveApp}>Save Application</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
