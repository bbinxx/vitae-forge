import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.js';
import SectionToggleBar from '../components/SectionToggleBar.jsx';
import LivePdfPreview from '../components/common/LivePdfPreview.jsx';
import JsonEditor from '../components/common/JsonEditor.jsx';

export default function SavedResumesPage() {
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_bookmarks');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [filterText, setFilterText] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [jsonData, setJsonData] = useState({});
  const [previewType, setPreviewType] = useState('resume');
  const [includePhoto, setIncludePhoto] = useState(true);

  // Modal States for Create / Rename
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newResumeName, setNewResumeName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const data = await apiFetch('/bookmarks');
      const list = data.bookmarks || [];
      setBookmarks(list);
      localStorage.setItem('cached_bookmarks', JSON.stringify(list));
    } catch (e) {
      console.error('Failed to load bookmarks:', e);
    }
  };

  const handleCreateNew = async () => {
    if (!newResumeName.trim()) return;
    try {
      const configRes = await apiFetch('/get-config').catch(() => ({}));
      const baseConfig = configRes.master || configRes || {};

      const created = await apiFetch('/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          name: newResumeName.trim(),
          data: baseConfig,
        }),
      });

      setShowCreateModal(false);
      setNewResumeName('');
      loadBookmarks();
      if (created.bookmark) openEditor(created.bookmark);
    } catch (e) {
      alert('Failed to create resume: ' + e.message);
    }
  };

  const handleClone = async (bm, e) => {
    e.stopPropagation();
    try {
      await apiFetch('/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          name: `${bm.name} (Copy)`,
          data: bm.data || {},
        }),
      });
      loadBookmarks();
    } catch (e) {
      alert('Failed to clone: ' + e.message);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await apiFetch(`/bookmarks/${renameTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: renameValue.trim(),
          data: renameTarget.data || {},
        }),
      });
      setShowRenameModal(false);
      setRenameTarget(null);
      setRenameValue('');
      loadBookmarks();
    } catch (e) {
      alert('Failed to rename: ' + e.message);
    }
  };

  const openEditor = (item) => {
    setSelectedItem(item);
    const data = item.data || {};
    setJsonData(data);
    setIncludePhoto(data.sections ? data.sections.photo !== false : true);
  };

  const handleToggleSection = (secKey) => {
    setJsonData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy.sections && typeof copy.sections === 'object') {
        copy.sections[secKey] = copy.sections[secKey] === false;
      } else if (copy.resume_template) {
        if (!copy.resume_template.sections) copy.resume_template.sections = {};
        copy.resume_template.sections[secKey] = copy.resume_template.sections[secKey] === false;
      } else {
        copy.sections = { [secKey]: false };
      }
      return copy;
    });
  };

  const handleSave = async () => {
    if (!selectedItem || !selectedItem.id) return;
    try {
      await apiFetch(`/bookmarks/${selectedItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: selectedItem.name, data: jsonData }),
      });
      alert('Saved successfully!');
      loadBookmarks();
    } catch (e) {
      alert('Failed to save: ' + e.message);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved resume?')) return;
    try {
      await apiFetch(`/bookmarks/${id}`, { method: 'DELETE' });
      loadBookmarks();
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const filteredBookmarks = bookmarks.filter((b) =>
    (b.name || '').toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Saved Resumes Studio</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage, edit, clone, and export customized resume versions.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Filter saved resumes..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ width: '220px' }}
          />
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>add</span> New Resume
          </button>
        </div>
      </div>

      {/* Resumes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
        {filteredBookmarks.map((bm) => (
          <div
            key={bm.id}
            onClick={() => openEditor(bm)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'all 0.15s',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{bm.name}</div>
                <div style={{ display: 'flex', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost"
                    title="Rename"
                    style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                    onClick={() => { setRenameTarget(bm); setRenameValue(bm.name); setShowRenameModal(true); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                  </button>
                  <button
                    className="btn btn-ghost"
                    title="Duplicate / Clone"
                    style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                    onClick={(e) => handleClone(bm, e)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                  </button>
                  <button
                    className="btn btn-ghost"
                    title="Delete"
                    style={{ padding: '2px 4px', color: '#ef4444' }}
                    onClick={(e) => handleDelete(bm.id, e)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                  </button>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Saved {bm.created_at ? new Date(bm.created_at).toLocaleDateString() : 'Recently'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-soft)', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>Open Studio</span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>arrow_forward</span>
            </div>
          </div>
        ))}

        {filteredBookmarks.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            No saved resumes found. Click <strong>"New Resume"</strong> to create one.
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '380px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Create New Saved Resume</h3>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Senior Backend Engineer - Google"
              value={newResumeName}
              onChange={(e) => setNewResumeName(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateNew}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '380px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Rename Resume</h3>
            <input
              type="text"
              className="input-field"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowRenameModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRename}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', width: '94%', height: '90vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{selectedItem.name}</h3>
              <button className="btn btn-ghost" onClick={() => setSelectedItem(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1, padding: '16px', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, flex: 1 }}>
                <SectionToggleBar sections={jsonData.sections || (jsonData.resume_template && jsonData.resume_template.sections)} onToggleSection={handleToggleSection} />
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

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Close</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
