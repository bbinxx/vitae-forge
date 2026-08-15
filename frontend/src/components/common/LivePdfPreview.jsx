import React, { useState, useEffect, useRef } from 'react';

export default function LivePdfPreview({ jsonPayload, previewType = 'resume', includePhoto = true, onToggleType, onTogglePhoto }) {
  const [loadingPct, setLoadingPct] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!jsonPayload) return;

    setIsLoading(true);
    setLoadingPct(0);

    if (timerRef.current) clearInterval(timerRef.current);
    let pct = 0;
    timerRef.current = setInterval(() => {
      pct += Math.floor(Math.random() * 15) + 10;
      if (pct >= 95) {
        pct = 95;
        clearInterval(timerRef.current);
      }
      setLoadingPct(pct);
    }, 60);

    const debounceTimer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/preview-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            config: typeof jsonPayload === 'string' ? JSON.parse(jsonPayload) : jsonPayload,
            include_photo: includePhoto,
            type: previewType
          })
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
          setLoadingPct(100);
        }
      } catch (e) {
        console.error('PDF Compile Error:', e);
      } finally {
        clearInterval(timerRef.current);
        setTimeout(() => setIsLoading(false), 200);
      }
    }, 500);

    return () => {
      clearTimeout(debounceTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jsonPayload, previewType, includePhoto]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px 6px 0 0' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.1em' }}>description</span> Live PDF Preview
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '10px', padding: '2px 8px', background: previewType === 'resume' ? 'var(--accent)' : 'transparent', color: previewType === 'resume' ? 'white' : 'var(--text-primary)' }}
            onClick={() => onToggleType && onToggleType('resume')}
          >
            Resume
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '10px', padding: '2px 8px', background: previewType === 'cover_letter' ? 'var(--accent)' : 'transparent', color: previewType === 'cover_letter' ? 'white' : 'var(--text-primary)' }}
            onClick={() => onToggleType && onToggleType('cover_letter')}
          >
            Cover Letter
          </button>
          <span style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }}></span>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '10px', padding: '2px 8px', background: includePhoto ? 'var(--accent)' : 'transparent', color: includePhoto ? 'white' : 'var(--text-primary)' }}
            onClick={() => onTogglePhoto && onTogglePhoto(!includePhoto)}
            title="Include photo"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: '-2px' }}>photo_camera</span> Photo
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden', background: '#525659' }}>
        {isLoading && (
          <div className="sr-loading-overlay">
            <div className="sr-spinner"></div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#818cf8', marginTop: '4px' }}>{loadingPct}%</div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#e2e8f0' }}>Compiling PDF preview...</span>
          </div>
        )}
        <iframe src={pdfUrl || 'about:blank'} title="PDF Preview" style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    </div>
  );
}
