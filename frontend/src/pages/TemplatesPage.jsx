import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.js';

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState('recipes'); // 'recipes' | 'tex'
  const [recipes, setRecipes] = useState({});
  const [selectedRecipeKey, setSelectedRecipeKey] = useState(null);
  const [recipeData, setRecipeData] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRecipeKey, setNewRecipeKey] = useState('');
  const [newRecipeTitle, setNewRecipeTitle] = useState('');

  // TeX Templates
  const [texTemplates, setTexTemplates] = useState([
    { name: 'Standard Plain LaTeX', filename: 'template.tex', description: 'Clean single-column professional resume layout.' },
    { name: 'Photo Included Layout', filename: 'template_photo.tex', description: 'Includes profile photo header block.' },
    { name: 'Cover Letter Layout', filename: 'cover_letter.tex', description: 'Matching cover letter formatting template.' },
  ]);
  const [selectedTex, setSelectedTex] = useState(null);
  const [texContent, setTexContent] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await apiFetch('/get-config');
      const recs = (data && data.recipes) || {};
      setRecipes(recs);
    } catch (e) {
      console.error('Failed to load config recipes:', e);
    }
  };

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
      loadConfig();
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
      loadConfig();
    } catch (e) {
      alert('Failed to create recipe: ' + e.message);
    }
  };

  const handleCloneRecipe = async (key, rec, e) => {
    e.stopPropagation();
    const cloneKey = `${key}_copy`;
    try {
      const currentConfig = await apiFetch('/get-config');
      const cloned = JSON.parse(JSON.stringify(rec));
      cloned.short_name = `${cloned.short_name || 'REC'}_COPY`.slice(0, 8);

      const updatedRecipes = { ...(currentConfig.recipes || {}), [cloneKey]: cloned };

      await apiFetch('/save-config', {
        method: 'POST',
        body: JSON.stringify({ ...currentConfig, recipes: updatedRecipes }),
      });

      loadConfig();
    } catch (e) {
      alert('Failed to clone recipe: ' + e.message);
    }
  };

  const handleDeleteRecipe = async (key, e) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete template recipe "${key}"?`)) return;
    try {
      const currentConfig = await apiFetch('/get-config');
      const updatedRecipes = { ...(currentConfig.recipes || {}) };
      delete updatedRecipes[key];

      await apiFetch('/save-config', {
        method: 'POST',
        body: JSON.stringify({ ...currentConfig, recipes: updatedRecipes }),
      });

      if (selectedRecipeKey === key) setSelectedRecipeKey(null);
      loadConfig();
    } catch (e) {
      alert('Failed to delete recipe: ' + e.message);
    }
  };

  const handleInspectTex = async (tpl) => {
    setSelectedTex(tpl);
    try {
      const res = await apiFetch(`/api/template/${tpl.filename}`);
      setTexContent(res.content || '');
    } catch (e) {
      setTexContent('% Failed to load template file content.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* Top Header & Sub-Nav Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Templates & Role Presets Studio</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Configure role target recipes and inspect underlying TeX layout sources.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            className={`btn ${activeTab === 'recipes' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('recipes')}
          >
            Role Presets (Recipes)
          </button>
          <button
            className={`btn ${activeTab === 'tex' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('tex')}
          >
            LaTeX Source Files
          </button>
        </div>
      </div>

      {/* Role Presets (Recipes) View */}
      {activeTab === 'recipes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Active Role Recipes</h3>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>add</span> Create Role Recipe
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {Object.entries(recipes).map(([key, rec]) => (
              <div
                key={key}
                onClick={() => handleSelectRecipe(key, rec)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      {rec.short_name || key.toUpperCase()}
                    </span>
                    <h4 style={{ margin: '6px 0 0 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rec.role_title || key}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-ghost"
                      title="Clone Recipe"
                      style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                      onClick={(e) => handleCloneRecipe(key, rec, e)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                    </button>
                    <button
                      className="btn btn-ghost"
                      title="Delete Recipe"
                      style={{ padding: '2px 4px', color: '#ef4444' }}
                      onClick={(e) => handleDeleteRecipe(key, e)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                    </button>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {typeof rec.professional_summary === 'string' ? rec.professional_summary : 'Custom summary configured.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TeX Source Files View */}
      {activeTab === 'tex' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {texTemplates.map((tpl) => (
            <div
              key={tpl.filename}
              onClick={() => handleInspectTex(tpl)}
              style={{
                background: 'var(--bg-card)',
                padding: '20px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{tpl.name}</div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--mono)', color: 'var(--accent)' }}>backend/templates/tex/{tpl.filename}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{tpl.description}</div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '10px', alignSelf: 'flex-start' }}>
                Inspect TeX Code
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Recipe Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Create New Role Preset</h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Recipe Key ID</label>
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
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Display Role Title</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Staff Backend Engineer"
                value={newRecipeTitle}
                onChange={(e) => setNewRecipeTitle(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateRecipe}>Create Preset</button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Editor Modal */}
      {selectedRecipeKey && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', width: '600px', borderRadius: '12px', padding: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Edit Role Recipe: {selectedRecipeKey}</h3>
              <button className="btn btn-ghost" onClick={() => setSelectedRecipeKey(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Role Title</label>
              <input
                type="text"
                className="input-field"
                value={recipeData.role_title || ''}
                onChange={(e) => setRecipeData({ ...recipeData, role_title: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Professional Summary</label>
              <textarea
                className="input-field"
                rows="4"
                value={typeof recipeData.professional_summary === 'string' ? recipeData.professional_summary : ''}
                onChange={(e) => setRecipeData({ ...recipeData, professional_summary: e.target.value })}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedRecipeKey(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveRecipe}>Save Recipe</button>
            </div>
          </div>
        </div>
      )}

      {/* TeX Viewer Modal */}
      {selectedTex && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', width: '800px', height: '80vh', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{selectedTex.name} ({selectedTex.filename})</h3>
              <button className="btn btn-ghost" onClick={() => setSelectedTex(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <pre style={{ flex: 1, margin: 0, padding: '14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'auto', fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              {texContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
