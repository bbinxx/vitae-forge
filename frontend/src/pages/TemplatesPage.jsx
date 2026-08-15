import React from 'react';

export default function TemplatesPage() {
  const templates = [
    { name: 'Standard Plain LaTeX', filename: 'template.tex', description: 'Clean single-column professional resume layout.' },
    { name: 'Photo Included Layout', filename: 'template_photo.tex', description: 'Includes profile photo header block.' },
    { name: 'Cover Letter Layout', filename: 'cover_letter.tex', description: 'Matching cover letter formatting template.' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>LaTeX Templates Gallery</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Built-in TeX compile targets used by the build engine.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {templates.map(tpl => (
          <div key={tpl.filename} style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{tpl.name}</div>
            <div style={{ fontSize: '0.75rem', fontFamily: 'var(--mono)', color: 'var(--accent)' }}>backend/templates/tex/{tpl.filename}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{tpl.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
