import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../../services/api';
import LivePdfPreview from '../../components/common/LivePdfPreview';
import { Recipe } from '../../types';

interface TexTemplate {
  name: string;
  filename: string;
}

const TEMPLATES: TexTemplate[] = [
  { name: 'Standard Plain LaTeX', filename: 'template.tex' },
  { name: 'Photo Header Layout', filename: 'template_photo.tex' },
  { name: 'Cover Letter Layout', filename: 'cover_letter.tex' }
];

export default function TemplatesPage() {
  const [activeSubTab, setActiveSubTab] = useState<'ide' | 'recipes'>('ide');
  const [selectedTex, setSelectedTex] = useState<TexTemplate>(TEMPLATES[0]);
  const [texContent, setTexContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const [masterConfig, setMasterConfig] = useState<any>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'list' | 'editor' | 'preview'>('editor');

  // Recipes States
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);

  // Form states for recipe
  const [recipeTitle, setRecipeTitle] = useState('');
  const [recipeSummary, setRecipeSummary] = useState('');
  const [recipeSkills, setRecipeSkills] = useState('');
  const [recipeKeywords, setRecipeKeywords] = useState('');

  useEffect(() => {
    loadTex(selectedTex.filename);
    loadMasterConfig();
    loadRecipes();
  }, [selectedTex]);

  const loadRecipes = () => {
    try {
      const stored = localStorage.getItem('role_recipes');
      if (stored) {
        setRecipes(JSON.parse(stored));
      } else {
        const defaultRecipes: Recipe[] = [
          { role_title: 'Backend Developer', professional_summary: 'Experienced in distributed microservices, DB optimization, and RESTful APIs.', skills: ['Node.js', 'Go', 'Postgres', 'Redis'], keywords: ['Scale', 'Performance', 'Redis'] },
          { role_title: 'Frontend Developer', professional_summary: 'Specializing in reactive user interfaces, component-driven layouts, and browser profiling.', skills: ['React', 'TypeScript', 'Vite', 'CSS'], keywords: ['UX', 'FCP', 'SaaS'] }
        ];
        setRecipes(defaultRecipes);
        localStorage.setItem('role_recipes', JSON.stringify(defaultRecipes));
      }
    } catch {}
  };

  const saveRecipes = (updated: Recipe[]) => {
    setRecipes(updated);
    localStorage.setItem('role_recipes', JSON.stringify(updated));
  };

  const loadMasterConfig = async () => {
    try {
      const configRes = await api.getConfig();
      setMasterConfig(configRes.master || configRes || {});
    } catch {}
  };

  const loadTex = async (filename: string) => {
    setLoading(true);
    setIsModified(false);
    try {
      const res = await api.getTemplate(filename);
      setTexContent(res.content || '');
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTex = async () => {
    setSaving(true);
    try {
      await api.saveTemplate(selectedTex.filename, texContent);
      setIsModified(false);
      alert('Template saved successfully!');
    } catch (e: any) {
      alert('Failed to save template: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isModified && !saving) {
          handleSaveTex();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModified, saving, texContent]);

  const handleAddRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeTitle.trim()) return;

    const newRecipe: Recipe = {
      role_title: recipeTitle.trim(),
      professional_summary: recipeSummary.trim(),
      skills: recipeSkills.split(',').map(s => s.trim()).filter(Boolean),
      keywords: recipeKeywords.split(',').map(s => s.trim()).filter(Boolean)
    };

    const updated = [...recipes, newRecipe];
    saveRecipes(updated);
    setShowRecipeModal(false);
    setRecipeTitle('');
    setRecipeSummary('');
    setRecipeSkills('');
    setRecipeKeywords('');
  };

  const handleDeleteRecipe = (title: string) => {
    if (confirm('Delete this recipe profile?')) {
      const updated = recipes.filter(r => r.role_title !== title);
      saveRecipes(updated);
      if (selectedRecipe?.role_title === title) {
        setSelectedRecipe(null);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Sub Tabs Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Templates & Customizing recipes</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure LaTeX styling and design targeting keywords.</p>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setActiveSubTab('ide')}
            style={{
              background: activeSubTab === 'ide' ? 'var(--accent)' : 'transparent',
              color: activeSubTab === 'ide' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '0.75rem',
              padding: '6px 12px'
            }}
          >
            LaTeX IDE Studio
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setActiveSubTab('recipes')}
            style={{
              background: activeSubTab === 'recipes' ? 'var(--accent)' : 'transparent',
              color: activeSubTab === 'recipes' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '0.75rem',
              padding: '6px 12px'
            }}
          >
            Role Target Recipes
          </button>
        </div>
      </div>

      {activeSubTab === 'ide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
          {/* Top Bar for IDE Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            {/* Mobile Section View Switcher */}
            <div className="mobile-only" style={{ gap: '4px', background: 'var(--bg-surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <button className={`btn btn-sm ${activeMobileTab === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveMobileTab('list')}>Files</button>
              <button className={`btn btn-sm ${activeMobileTab === 'editor' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveMobileTab('editor')}>Code</button>
              <button className={`btn btn-sm ${activeMobileTab === 'preview' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveMobileTab('preview')}>PDF</button>
            </div>

            {isModified && (
              <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>
                Unsaved Changes
              </span>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveTex}
              disabled={saving || !isModified}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>save</span>
              <span>{saving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
            </button>
          </div>

          {/* IDE Main Split Layout */}
          <div className="templates-ide-grid" style={{ overflowY: 'auto' }}>
            {/* Template Selector Cards */}
            <div className={`selector-pane ${activeMobileTab !== 'list' ? 'hidden-mobile' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Template Files
              </div>
              {TEMPLATES.map((tpl) => {
                const isActive = selectedTex.filename === tpl.filename;
                return (
                  <div
                    key={tpl.filename}
                    onClick={() => {
                      setSelectedTex(tpl);
                      setActiveMobileTab('editor');
                    }}
                    style={{
                      background: isActive ? 'var(--accent-dim)' : 'var(--bg-card)',
                      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {tpl.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', fontFamily: 'var(--mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {tpl.filename}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Monaco Code Editor */}
            <div className={`editor-pane ${activeMobileTab !== 'editor' ? 'hidden-mobile' : ''}`} style={{ background: '#1e1e1e', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '350px' }}>
              <div style={{ padding: '8px 12px', background: '#252526', borderBottom: '1px solid #333333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', fontWeight: 600, color: '#cccccc' }}>
                  {selectedTex.filename}
                </span>
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
                    onChange={(val) => {
                      setTexContent(val || '');
                      setIsModified(true);
                    }}
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

            {/* Live PDF Preview Pane */}
            <div className={`preview-pane ${activeMobileTab !== 'preview' ? 'hidden-mobile' : ''}`} style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: '350px' }}>
              <LivePdfPreview
                jsonPayload={masterConfig}
                previewType={selectedTex.filename === 'cover_letter.tex' ? 'cover_letter' : 'resume'}
                includePhoto={selectedTex.filename === 'template_photo.tex'}
              />
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'recipes' && (
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          {/* Left: Recipe List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Profiles</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRecipeModal(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span> Add Recipe
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recipes.map((rec) => (
                <div
                  key={rec.role_title}
                  onClick={() => setSelectedRecipe(rec)}
                  style={{
                    background: selectedRecipe?.role_title === rec.role_title ? 'var(--accent-dim)' : 'var(--bg-card)',
                    border: selectedRecipe?.role_title === rec.role_title ? '1px solid var(--accent)' : '1px solid var(--border)',
                    padding: '12px',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{rec.role_title}</span>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '4px' }} onClick={() => handleDeleteRecipe(rec.role_title)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Selected Recipe details */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px'
          }}>
            {selectedRecipe ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedRecipe.role_title}</h3>

                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Summary Directive Guidance</span>
                  <p style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', marginTop: '4px', border: '1px solid var(--border-soft)' }}>
                    {selectedRecipe.professional_summary}
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Preferred Skillset</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {selectedRecipe.skills?.map(skill => (
                      <span key={skill} style={{ padding: '2px 8px', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>{skill}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Important Keywords</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {selectedRecipe.keywords?.map(kw => (
                      <span key={kw} style={{ padding: '2px 8px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Select a role profile recipe from the left to view tailoring directives.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Recipe modal */}
      {showRecipeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '440px', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Create Role Profile Recipe</span>
              <button className="btn btn-ghost" onClick={() => setShowRecipeModal(false)} style={{ padding: '4px' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddRecipe} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Target Title</label>
                <input type="text" className="input-field" value={recipeTitle} onChange={e => setRecipeTitle(e.target.value)} required placeholder="e.g. Backend Developer" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Summary Directive</label>
                <textarea className="input-field" style={{ minHeight: '60px' }} value={recipeSummary} onChange={e => setRecipeSummary(e.target.value)} required placeholder="Summary content guidance..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Preferred Skills (comma separated)</label>
                <input type="text" className="input-field" value={recipeSkills} onChange={e => setRecipeSkills(e.target.value)} placeholder="Go, Postgres, Redis" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Target Keywords (comma separated)</label>
                <input type="text" className="input-field" value={recipeKeywords} onChange={e => setRecipeKeywords(e.target.value)} placeholder="Scalability, Performance" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRecipeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Recipe</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
