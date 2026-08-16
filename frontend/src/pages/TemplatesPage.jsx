import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { apiFetch } from '../services/api.js';

export default function TemplatesPage() {
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
  const editorRef = useRef(null);

  useEffect(() => {
    // Open standard template by default
    handleOpenTex(texTemplates[0]);
  }, []);

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

    // Add Ctrl+S / Cmd+S save action
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveTex();
    });
  };

  const isModified = texContent !== originalContent;
  const lineCount = texContent.split('\n').length;
  const charCount = texContent.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'hidden' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>LaTeX Templates IDE Studio (Monaco VS Code)</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Professional VS Code editor for editing and customizing raw LaTeX source files.</p>
        </div>

        {selectedTex && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isModified && (
              <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>
                Unsaved Changes
              </span>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSaveTex}
              disabled={saving || !isModified}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>save</span>
              <span>{saving ? 'Saving...' : 'Save LaTeX Source (Ctrl+S)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Studio Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Template Selector Cards Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Template Files
          </div>
          {texTemplates.map((tpl) => {
            const isActive = selectedTex?.filename === tpl.filename;
            return (
              <div
                key={tpl.filename}
                onClick={() => handleOpenTex(tpl)}
                style={{
                  background: isActive ? 'var(--accent-dim)' : 'var(--bg-card)',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {tpl.name}
                </div>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                  backend/templates/tex/{tpl.filename}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {tpl.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* Monaco IDE Code Editor Container */}
        <div style={{ background: '#1e1e1e', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {/* Editor Header Bar */}
          <div style={{ padding: '10px 16px', background: '#252526', borderBottom: '1px solid #333333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)' }}>integration_instructions</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', fontWeight: 600, color: '#cccccc' }}>
                {selectedTex?.filename || 'No file selected'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: '#858585', fontFamily: 'var(--mono)' }}>
              <span>Lines: {lineCount}</span>
              <span>Chars: {charCount}</span>
              <span>Monaco LaTeX IDE</span>
            </div>
          </div>

          {/* Monaco Editor Frame */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {loading ? (
              <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#858585' }}>
                Loading Monaco VS Code Editor...
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
                  fontSize: 13.5,
                  fontFamily: "'Fira Code', 'Consolas', 'Menlo', monospace",
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  smoothScrolling: true,
                  lineNumbers: 'on',
                  renderWhitespace: 'selection',
                  bracketPairColorization: { enabled: true },
                  padding: { top: 12, bottom: 12 },
                }}
              />
            )}
          </div>

          {/* Editor Footer Status Bar */}
          <div style={{ padding: '6px 16px', background: '#007acc', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 500 }}>
            <span>Path: backend/templates/tex/{selectedTex?.filename}</span>
            <span>{isModified ? '● Modified (Press Ctrl+S to save)' : '✓ Saved'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
