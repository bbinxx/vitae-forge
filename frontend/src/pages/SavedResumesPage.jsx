import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.js';
import SectionToggleBar from '../components/SectionToggleBar.jsx';
import LivePdfPreview from '../components/common/LivePdfPreview.jsx';
import JsonEditor from '../components/common/JsonEditor.jsx';

export default function SavedResumesPage() {
  const [bookmarks, setBookmarks] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [jsonData, setJsonData] = useState({});
  const [previewType, setPreviewType] = useState('resume');
  const [includePhoto, setIncludePhoto] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const data = await apiFetch('/bookmarks');
      setBookmarks(data.bookmarks || []);
    } catch (e) {
      console.error('Failed to load bookmarks:', e);
    }
  };

  const openEditor = (item) => {
    setSelectedItem(item);
    const data = item.data || {};
    setJsonData(data);
    setIncludePhoto(data.sections ? data.sections.photo !== false : true);
  };

  const handleToggleSection = (secKey) => {
    setJsonData(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy.sections && typeof copy.sections === 'object') {
        copy.sections[secKey] = copy.sections[secKey] === false ? true : false;
      } else if (copy.resume_template) {
        if (!copy.resume_template.sections) copy.resume_template.sections = {};
        copy.resume_template.sections[secKey] = copy.resume_template.sections[secKey] === false ? true : false;
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
        body: JSON.stringify({ name: selectedItem.name, data: jsonData })
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

  const filteredBookmarks = bookmarks.filter(b => b.name.toLowerCase().includes(filterText.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Saved Resumes Studio</h2>
        <input
          type="text"
          className="search-input"
          placeholder="Filter saved resumes..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          style={{ width: '240px' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {filteredBookmarks.map(bm => (
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
              gap: '8px',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{bm.name}</div>
              <button
                className="btn btn-ghost"
                style={{ color: '#ef4444', padding: '2px 4px' }}
                onClick={(e) => handleDelete(bm.id, e)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Saved {bm.created_at ? new Date(bm.created_at).toLocaleDateString() : ''}
            </div>
          </div>
        ))}
      </div>

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
