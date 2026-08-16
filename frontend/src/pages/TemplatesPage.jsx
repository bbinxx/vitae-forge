import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { apiFetch } from '../services/api.js';
import LivePdfPreview from '../components/common/LivePdfPreview.jsx';

export default function TemplatesPage() {
  const [subTab, setSubTab] = useState('ide'); // 'ide' | 'recipes'

  // TeX Templates & Monaco IDE State
  const [texTemplates, setTexTemplates] = useState([
    { id: 'standard', name: 'Standard Plain LaTeX', filename: 'template.tex', description: 'Clean single-column professional ATS resume layout.' },
    { id: 'photo', name: 'Photo Included Layout', filename: 'template_photo.tex', description: 'Includes profile photo header block for executive resumes.' },
    { id: 'cover_letter', name: 'Cover Letter Layout', filename: 'cover_letter.tex', description: 'Matching formal cover letter formatting template.' },
  ]);

  const [selectedTex, setSelectedTex] = useState(null);
  const [texContent, setTexContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('list'); // 'list' | 'editor' | 'preview'
  const [showPreview, setShowPreview] = useState(true);
  const [masterConfig, setMasterConfig] = useState({});

  // Role Target Recipes State
  const [recipes, setRecipes] = useState({});
  const [selectedRecipeKey, setSelectedRecipeKey] = useState(null);
  const [recipeData, setRecipeData] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRecipeKey, setNewRecipeKey] = useState('');
  const [newRecipeTitle, setNewRecipeTitle] = useState('');

  const editorRef = useRef(null);

  useEffect(() => {
    handleOpenTex(texTemplates[0]);
    loadMasterConfig();
  }, []);

  const loadMasterConfig = async () => {
    try {
      const data = await apiFetch('/get-config');
      const base = data.master || data || {};
      setMasterConfig(base);
      const recs = data.recipes || {};
      setRecipes(recs);
      if (Object.keys(recs).length > 0 && !selectedRecipeKey) {
        const firstKey = Object.keys(recs)[0];
        setSelectedRecipeKey(firstKey);
        setRecipeData(recs[firstKey]);
      }
    } catch (e) {
      console.error('Failed to load master config:', e);
    }
  };

  const handleOpenTex = async (tpl) => {
    setSelectedTex(tpl);
    setLoading(true);
    try {
      const res = await apiFetch(`/api/template/${tpl.filename}`);
      const content = res.content || '';
      setTexContent(content);
      setOriginalContent(content);
    } catch (e) {
      setTexContent('% Error loading template file.');
      setOriginalContent('');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTex = async () => {
    if (!selectedTex) return;
    setSaving(true);
    try {
      await apiFetch(`/api/template/${selectedTex.filename}`, {
        method: 'PUT',
        body: JSON.stringify({ content: texContent }),
      });
      setOriginalContent(texContent);
      alert(`Saved ${selectedTex.filename} successfully!`);
    } catch (e) {
      alert('Failed to save template: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveTex();
    });
  };

  // Recipe Management Functions
  const handleSelectRecipe = (key, rec) => {
    setSelectedRecipeKey(key);
    setRecipeData(JSON.parse(JSON.stringify(rec)));
  };

  const handleSaveRecipe = async () => {
    if (!selectedRecipeKey) return;
    try {
      const currentConfig = await apiFetch('/get-config');
      const updatedRecipes = { ...(currentConfig.recipes || {}), [selectedRecipeKey]: recipeData };

      await apiFetch('/save-config', {
        method: 'POST',
        body: JSON.stringify({ ...currentConfig, recipes: updatedRecipes }),
      });

      alert(`Recipe "${selectedRecipeKey}" saved successfully!`);
      loadMasterConfig();
    } catch (e) {
      alert('Failed to save recipe: ' + e.message);
    }
  };

  const handleCreateRecipe = async () => {
    if (!newRecipeKey.trim() || !newRecipeTitle.trim()) return;
    const cleanKey = newRecipeKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    try {
      const currentConfig = await apiFetch('/get-config');
      const updatedRecipes = {
        ...(currentConfig.recipes || {}),
        [cleanKey]: {
          short_name: cleanKey.toUpperCase().slice(0, 8),
          role_title: newRecipeTitle.trim(),
          professional_summary: 'Software Engineer with experience building reliable backend systems.',
          sections: { role_title: true, summary: true, skills: true, experience: true, projects: true },
        },
      };

      await apiFetch('/save-config', {
        method: 'POST',
        body: JSON.stringify({ ...currentConfig, recipes: updatedRecipes }),
      });

      setShowCreateModal(false);
      setNewRecipeKey('');
      setNewRecipeTitle('');
      loadMasterConfig();
    } catch (e) {
      alert('Failed to create recipe: ' + e.message);
    }
  };

  const handleDeleteRecipe = async (key, e) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete recipe "${key}"?`)) return;
    try {
      const currentConfig = await apiFetch('/get-config');
      const copy = { ...(currentConfig.recipes || {}) };
      delete copy[key];

      await apiFetch('/save-config', {
        method: 'POST',
        body: JSON.stringify({ ...currentConfig, recipes: copy }),
      });

      loadMasterConfig();
    } catch (e) {
      alert('Failed to delete recipe: ' + e.message);
    }
  };

  const isModified = texContent !== originalContent;
  const lineCount = texContent.split('\n').length;
  const charCount = texContent.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'hidden' }}>
      {/* Top Navigation Sub-Tabs Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Templates & Role Studio</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customize LaTeX source templates and targeted job role profiles.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            className={`btn ${subTab === 'ide' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSubTab('ide')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>code</span> LaTeX Monaco IDE
          </button>
          <button
            className={`btn ${subTab === 'recipes' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSubTab('recipes')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>tune</span> Role Target Recipes
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: LATEX MONACO IDE & LIVE PREVIEW */}
      {subTab === 'ide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
          {/* Top Bar for IDE Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            {/* Mobile View Switcher */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <button
                className={`btn btn-sm ${activeMobileTab === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveMobileTab('list')}
              >
                📂 Files
              </button>
              <button
                className={`btn btn-sm ${activeMobileTab === 'editor' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveMobileTab('editor')}
              >
                💻 Code
              </button>
              <button
                className={`btn btn-sm ${activeMobileTab === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveMobileTab('preview')}
              >
                📄 PDF
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className={`btn btn-sm ${showPreview ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setShowPreview(!showPreview)}
                title="Toggle live PDF split preview"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>preview</span> {showPreview ? 'Hide PDF' : 'Show PDF'}
              </button>

              {isModified && (
                <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>
                  Unsaved
                </span>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveTex}
                disabled={saving || !isModified}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>save</span>
                <span>{saving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
              </button>
            </div>
          </div>

          {/* IDE Main Split Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '220px 1fr 1fr' : '240px 1fr', gap: '12px', flex: 1, minHeight: 0 }}>
            {/* Template Selector Cards */}
            {(activeMobileTab === 'list' || window.innerWidth >= 768) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Template Files
                </div>
                {texTemplates.map((tpl) => {
                  const isActive = selectedTex?.filename === tpl.filename;
                  return (
                    <div
                      key={tpl.filename}
                      onClick={() => {
                        handleOpenTex(tpl);
                        setActiveMobileTab('editor');
                      }}
                      style={{
                        background: isActive ? 'var(--accent-dim)' : 'var(--bg-card)',
                        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {tpl.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                        {tpl.filename}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Monaco Code Editor */}
            {(activeMobileTab === 'editor' || window.innerWidth >= 768) && (
              <div style={{ background: '#1e1e1e', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '350px' }}>
                <div style={{ padding: '8px 12px', background: '#252526', borderBottom: '1px solid #333333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', fontWeight: 600, color: '#cccccc' }}>
                    {selectedTex?.filename}
                  </span>
                  <div style={{ fontSize: '0.7rem', color: '#858585', fontFamily: 'var(--mono)' }}>
                    {lineCount} lines | {charCount} chars
                  </div>
                </div>

                <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                  {loading ? (
                    <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#858585' }}>
                      Loading Monaco Code Editor...
                    </div>
                  ) : (
                    <Editor
                      height="100%"
                      defaultLanguage="stex"
                      language="stex"
                      theme="vs-dark"
                      value={texContent}
                      onChange={(val) => setTexContent(val || '')}
                      onMount={handleEditorDidMount}
                      options={{
                        fontSize: 13,
                        fontFamily: "'Fira Code', 'Consolas', monospace",
                        minimap: { enabled: false },
                        wordWrap: 'on',
                        automaticLayout: true,
                        lineNumbers: 'on',
                        padding: { top: 8, bottom: 8 },
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Live PDF Preview Pane */}
            {showPreview && (activeMobileTab === 'preview' || window.innerWidth >= 768) && (
              <LivePdfPreview
                jsonPayload={masterConfig}
                previewType={selectedTex?.filename === 'cover_letter.tex' ? 'cover_letter' : 'resume'}
                includePhoto={selectedTex?.filename === 'template_photo.tex'}
              />
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TARGET ROLE RECIPES */}
      {subTab === 'recipes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px', flex: 1, minHeight: 0 }}>
          {/* Recipe List Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Target Recipes</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>+ New Recipe</button>
            </div>

            {Object.keys(recipes).map((key) => {
              const rec = recipes[key];
              const isActive = selectedRecipeKey === key;
              return (
                <div
                  key={key}
                  onClick={() => handleSelectRecipe(key, rec)}
                  style={{
                    background: isActive ? 'var(--accent-dim)' : 'var(--bg-card)',
                    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{rec.role_title || key}</span>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={(e) => handleDeleteRecipe(key, e)}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                    </button>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>Key: {key}</span>
                </div>
              );
            })}
          </div>

          {/* Recipe Editor Column */}
          {selectedRecipeKey && recipeData ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Editing Recipe: {selectedRecipeKey}</h3>
                <button className="btn btn-primary" onClick={handleSaveRecipe}>Save Recipe</button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Target Role Title</label>
                <input
                  type="text"
                  className="input-field"
                  value={recipeData.role_title || ''}
                  onChange={(e) => setRecipeData({ ...recipeData, role_title: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Target Professional Summary</label>
                <textarea
                  className="input-field"
                  rows="4"
                  value={recipeData.professional_summary || ''}
                  onChange={(e) => setRecipeData({ ...recipeData, professional_summary: e.target.value })}
                  style={{ width: '100%', fontFamily: 'var(--font)' }}
                />
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
              Select a target role recipe from the left column to view or edit parameters.
            </div>
          )}
        </div>
      )}

      {/* Create Recipe Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '380px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Create New Target Role Recipe</h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Recipe Key (slug)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. backend_lead"
                value={newRecipeKey}
                onChange={(e) => setNewRecipeKey(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Role Title</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Lead Backend Engineer"
                value={newRecipeTitle}
                onChange={(e) => setNewRecipeTitle(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateRecipe}>Create Recipe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
