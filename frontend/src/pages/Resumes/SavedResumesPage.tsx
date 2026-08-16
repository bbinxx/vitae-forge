import React, { useState, useEffect } from 'react';
import { useResumes, resumeStore } from '../../stores/resumeStore';
import { Bookmark } from '../../types';
import JsonEditor from '../../components/common/JsonEditor';
import LivePdfPreview from '../../components/common/LivePdfPreview';
import SectionToggleBar from '../../components/SectionToggleBar';
import { api } from '../../services/api';

export default function SavedResumesPage() {
  const { bookmarks, loading, loadBookmarks } = useResumes();
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals & Creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newResumeName, setNewResumeName] = useState('');

  // Selected for studio modal
  const [selectedItem, setSelectedItem] = useState<Bookmark | null>(null);
  const [jsonData, setJsonData] = useState<any>(null);
  const [previewType, setPreviewType] = useState<'resume' | 'cover_letter'>('resume');
  const [includePhoto, setIncludePhoto] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<'editor' | 'preview'>('editor');
  const [savingConfig, setSavingConfig] = useState(false);

  // Rename states
  const [renamingItem, setRenamingItem] = useState<Bookmark | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    loadBookmarks();
  }, []);

  const handleCreateResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResumeName.trim()) return;

    try {
      const configRes = await api.getConfig().catch(() => ({}));
      const baseConfig = configRes.master || configRes || {};

      await resumeStore.create(newResumeName.trim(), baseConfig);
      setNewResumeName('');
      setShowCreateModal(false);
    } catch (e: any) {
      alert('Failed to create resume: ' + e.message);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedItem) return;
    setSavingConfig(true);
    try {
      const updatedBookmark = { ...selectedItem, data: jsonData };
      await api.updateBookmark(selectedItem.id, updatedBookmark);
      await loadBookmarks();
      alert('Resume saved successfully!');
    } catch (e: any) {
      alert('Failed to save resume: ' + e.message);
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

  const handleOpenStudio = (bm: Bookmark) => {
    setSelectedItem(bm);
    setJsonData(bm.data || {});
  };

  const handleDuplicate = async (bm: Bookmark, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Duplicate this resume?')) {
      await resumeStore.clone(bm);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this resume?')) {
      await resumeStore.delete(id);
    }
  };

  const handleStartRename = (bm: Bookmark, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingItem(bm);
    setRenameValue(bm.name);
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || !renameValue.trim()) return;
    await resumeStore.update(renamingItem.id, { name: renameValue.trim() });
    setRenamingItem(null);
  };

  // Filter & Sort
  const filteredBookmarks = bookmarks.filter(bm => 
    (bm.name || '').toLowerCase().includes(filterText.toLowerCase())
  );

  const sortedBookmarks = [...filteredBookmarks].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Saved Resumes</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage and duplicate multiple resume profiles.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span> New Resume
        </button>
      </div>

      {/* Filter and controls bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '12px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)'
      }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search resumes..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ flex: 1, minWidth: '160px', maxWidth: '240px' }}
        />

        <select
          className="input-field"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as any)}
          style={{ width: '140px' }}
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>

      {/* Resume Grid */}
      <div className="bookmarks-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {sortedBookmarks.map((bm) => (
          <div key={bm.id} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Visual Thumbnail Frame */}
            <div style={{
              height: '110px',
              background: 'var(--bg-elevated)',
              borderRadius: '6px',
              border: '1px solid var(--border-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--accent)' }}>description</span>
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{bm.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Updated {bm.created_at ? new Date(bm.created_at).toLocaleDateString() : 'Recently'}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleOpenStudio(bm)}>
                Open Studio
              </button>
              <button className="btn btn-secondary btn-sm" onClick={(e) => handleStartRename(bm, e)} title="Rename">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={(e) => handleDuplicate(bm, e)} title="Duplicate">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>
              </button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={(e) => handleDelete(bm.id, e)} title="Delete">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {sortedBookmarks.length === 0 && (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--accent)', marginBottom: '8px' }}>bookmark_border</span>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>No saved resumes yet</div>
          <p style={{ fontSize: '0.8rem', marginBottom: '16px' }}>Create templates tailored to individual job requirements here.</p>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Create your first resume
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '400px', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Create Saved Resume</span>
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)} style={{ padding: '4px' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateResume} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Profile Name</label>
                <input type="text" className="input-field" value={newResumeName} onChange={e => setNewResumeName(e.target.value)} required placeholder="e.g. Master Software Engineer Resume" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renamingItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '400px', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Rename Resume</span>
              <button className="btn btn-ghost" onClick={() => setRenamingItem(null)} style={{ padding: '4px' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveRename} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Name</label>
                <input type="text" className="input-field" value={renameValue} onChange={e => setRenameValue(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRenamingItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Rename</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Studio Modal */}
      {selectedItem && jsonData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="studio-modal" style={{ background: 'var(--bg-base)', width: '96%', height: '94vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{selectedItem.name}</h3>

              {/* Mobile View Switcher Tabs */}
              <div className="mobile-only" style={{ gap: '4px', background: 'var(--bg-surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <button className={`btn btn-sm ${activeMobileTab === 'editor' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveMobileTab('editor')}>
                  📝 Editor
                </button>
                <button className={`btn btn-sm ${activeMobileTab === 'preview' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveMobileTab('preview')}>
                  📄 Preview
                </button>
              </div>

              <button className="btn btn-ghost" onClick={() => setSelectedItem(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="studio-grid" style={{ overflowY: 'auto' }}>
              <div className={`editor-pane ${activeMobileTab === 'preview' ? 'hidden-mobile' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '300px', flex: 1, height: '100%' }}>
                <SectionToggleBar sections={jsonData.sections} onToggleSection={handleToggleSection} />
                <div style={{ flex: 1, position: 'relative', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', minHeight: '260px' }}>
                  <JsonEditor value={jsonData} onChange={setJsonData} />
                </div>
              </div>

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

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-card)', flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Close Studio</button>
              <button className="btn btn-primary" onClick={handleSaveConfig} disabled={savingConfig}>
                {savingConfig ? 'Saving...' : 'Save Resume'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
