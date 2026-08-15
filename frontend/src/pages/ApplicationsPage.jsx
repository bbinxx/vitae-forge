import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.js';
import SectionToggleBar from '../components/SectionToggleBar.jsx';
import LivePdfPreview from '../components/common/LivePdfPreview.jsx';
import JsonEditor from '../components/common/JsonEditor.jsx';

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedApp, setSelectedApp] = useState(null);
  const [jsonData, setJsonData] = useState({});
  const [previewType, setPreviewType] = useState('resume');
  const [includePhoto, setIncludePhoto] = useState(true);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const data = await apiFetch('/applications');
      setApplications(data.applications || data || []);
    } catch (e) {
      console.error('Failed to load applications:', e);
    }
  };

  const openAppEditor = (app) => {
    setSelectedApp(app);
    const data = app.resume_template || app;
    setJsonData(data);
    setIncludePhoto(app.include_photo !== false);
  };

  const handleToggleSection = (secKey) => {
    setJsonData(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (!copy.sections) copy.sections = {};
      copy.sections[secKey] = copy.sections[secKey] === false ? true : false;
      return copy;
    });
  };

  const handleSaveApp = async () => {
    if (!selectedApp || !selectedApp.id) return;
    try {
      await apiFetch(`/applications/${selectedApp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...selectedApp, resume_template: jsonData, include_photo: includePhoto })
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
        body: JSON.stringify({ name, data: jsonData, source_app_id: selectedApp?.id || '' })
      });
      alert(`"${name}" saved to Saved Resumes!`);
    } catch (e) {
      alert('Error bookmarking resume: ' + e.message);
    }
  };

  const filteredApps = applications.filter(app => {
    const matchesSearch = (app.company || '').toLowerCase().includes(filterText.toLowerCase()) ||
                          (app.role || '').toLowerCase().includes(filterText.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (app.status || '').toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Job Applications Control Center</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search company or role..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            style={{ width: '220px' }}
          />
          <select
            className="input-field"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: '130px', padding: '6px' }}
          >
            <option value="ALL">All Status</option>
            <option value="APPLIED">Applied</option>
            <option value="INTERVIEW">Interview</option>
            <option value="OFFER">Offer</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

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
            {filteredApps.map(app => (
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
                  <button className="btn btn-secondary btn-sm" onClick={() => openAppEditor(app)}>
                    Open Studio
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
