import React, { useState, useEffect, useRef } from 'react';

interface LivePdfPreviewProps {
  jsonPayload: any;
  previewType?: 'resume' | 'cover_letter';
  includePhoto?: boolean;
  onToggleType?: (type: 'resume' | 'cover_letter') => void;
  onTogglePhoto?: (photo: boolean) => void;
}

export default function LivePdfPreview({
  jsonPayload,
  previewType = 'resume',
  includePhoto = true,
  onToggleType,
  onTogglePhoto
}: LivePdfPreviewProps) {
  const [loadingPct, setLoadingPct] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [compileError, setCompileError] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showLogs, setShowLogs] = useState(false);

  const timerRef = useRef<any>(null);
  const elapsedTimerRef = useRef<any>(null);
  const lastCompiledPayloadRef = useRef<string>('');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [localIncludePhoto, setLocalIncludePhoto] = useState(includePhoto);

  useEffect(() => {
    setLocalIncludePhoto(includePhoto);
  }, [includePhoto]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCompile = async (force = false) => {
    if (!jsonPayload) return;
    
    const payloadStr = JSON.stringify({ jsonPayload, previewType, includePhoto: localIncludePhoto });
    if (!force && lastCompiledPayloadRef.current === payloadStr) {
      // Avoid compiling again if payload did not change
      return;
    }
    lastCompiledPayloadRef.current = payloadStr;

    setIsLoading(true);
    setCompileError('');
    setLoadingPct(10);
    setElapsedTime(0);

    // Dynamic timer simulating build compilation phases
    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

    timerRef.current = setInterval(() => {
      setLoadingPct((prev) => {
        if (prev >= 90) return 90; // Hold at 90 until fetch returns
        return prev + Math.floor(Math.random() * 8) + 5;
      });
    }, 150);

    elapsedTimerRef.current = setInterval(() => {
      setElapsedTime((prev) => parseFloat((prev + 0.1).toFixed(1)));
    }, 100);

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
          include_photo: localIncludePhoto,
          type: previewType
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setLoadingPct(100);
      } else {
        const errObj = await res.json().catch(() => ({}));
        setCompileError(errObj.detail || 'LaTeX Compilation Failed.');
        setLoadingPct(0);
      }
    } catch (e: any) {
      setCompileError(e.message || 'LaTeX engine communication failed.');
      setLoadingPct(0);
    } finally {
      clearInterval(timerRef.current);
      clearInterval(elapsedTimerRef.current);
      setTimeout(() => setIsLoading(false), 200);
    }
  };

  useEffect(() => {
    // Only recompile if content changes (debounced automatically to avoid heavy server cycles)
    const timer = setTimeout(() => {
      handleCompile();
    }, 600);

    return () => {
      clearTimeout(timer);
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [jsonPayload, previewType, localIncludePhoto]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header controls bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px 8px 0 0',
        flexWrap: 'wrap',
        gap: '8px',
        minHeight: '44px'
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>description</span> 
          Live PDF Preview
        </span>

        {/* Toggle options */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            style={{ 
              fontSize: '10px', 
              padding: '4px 10px', 
              background: previewType === 'resume' ? 'var(--accent)' : 'transparent', 
              color: previewType === 'resume' ? 'white' : 'var(--text-muted)' 
            }}
            onClick={() => onToggleType && onToggleType('resume')}
          >
            Resume
          </button>
          <button
            className="btn btn-ghost"
            style={{ 
              fontSize: '10px', 
              padding: '4px 10px', 
              background: previewType === 'cover_letter' ? 'var(--accent)' : 'transparent', 
              color: previewType === 'cover_letter' ? 'white' : 'var(--text-muted)' 
            }}
            onClick={() => onToggleType && onToggleType('cover_letter')}
          >
            Cover Letter
          </button>
          
          <span style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }}></span>

          <button
            className="btn btn-ghost"
            style={{ 
              fontSize: '10px', 
              padding: '4px 10px', 
              background: localIncludePhoto ? 'var(--accent-dim)' : 'transparent', 
              color: localIncludePhoto ? 'var(--accent)' : 'var(--text-muted)' 
            }}
            onClick={() => {
              const newVal = !localIncludePhoto;
              setLocalIncludePhoto(newVal);
              if (onTogglePhoto) onTogglePhoto(newVal);
            }}
            title="Include photo in compilation"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>photo_camera</span>
            Photo
          </button>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => handleCompile(true)}
            disabled={isLoading}
            style={{ padding: '3px 8px', fontSize: '10px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>refresh</span> Compile
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div style={{
        flex: 1,
        position: 'relative',
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        overflow: 'hidden',
        background: '#323639',
        minHeight: '280px'
      }}>
        {/* Compilation progress loader overlay */}
        {isLoading && (
          <div className="sr-loading-overlay">
            <div className="sr-spinner"></div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)', marginTop: '8px' }}>
              Compiling... {loadingPct}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Elapsed Time: {elapsedTime}s
            </div>
          </div>
        )}

        {/* LaTeX Compilation Error panel */}
        {compileError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.96)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#fda4af',
            zIndex: 10,
            overflowY: 'auto'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#f43f5e', marginBottom: '8px' }}>warning</span>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px', textAlign: 'center' }}>LaTeX Compilation Failed</div>
            <p style={{ fontSize: '0.75rem', color: '#cbd5e1', textAlign: 'center', maxWidth: '380px', marginBottom: '16px' }}>
              We could not generate the PDF due to compilation errors in your resume structure or template syntax.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-danger btn-sm" onClick={() => setShowLogs(true)}>
                View Compilation Logs
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleCompile(true)}>
                Retry Compilation
              </button>
            </div>
          </div>
        )}

        {/* Actual iframe embedding pdf */}
        {!compileError && (
          <iframe 
            src={pdfUrl ? `${pdfUrl}#toolbar=1&zoom=FitH` : 'about:blank'} 
            title="PDF Previewer" 
            style={{ width: '100%', height: '100%', border: 'none' }} 
          />
        )}
      </div>

      {/* Logs View Dialog Modal */}
      {showLogs && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', width: '96%', maxWidth: '640px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>LaTeX Compilation Output logs</span>
              <button className="btn btn-ghost" onClick={() => setShowLogs(false)} style={{ padding: '4px' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <pre style={{
              flex: 1,
              padding: '16px',
              background: '#090d16',
              color: '#34d399',
              fontFamily: 'var(--mono)',
              fontSize: '0.75rem',
              overflowY: 'auto',
              maxHeight: '380px',
              whiteSpace: 'pre-wrap'
            }}>
              {compileError || 'No compiler errors reported.'}
            </pre>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowLogs(false)}>Close Log</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
