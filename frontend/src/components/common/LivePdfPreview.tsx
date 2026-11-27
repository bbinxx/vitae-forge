import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSettings } from '../../stores/settingsStore';
import { api, redirectToSignIn } from '../../services/api';

interface LivePdfPreviewProps {
  jsonPayload: any;
  previewType?: 'resume' | 'cover_letter';
  includePhoto?: boolean;
  canCompile?: boolean;
  fileLabel?: string;
  onToggleType?: (type: 'resume' | 'cover_letter') => void;
  onTogglePhoto?: (photo: boolean) => void;
}

type PreviewProgress = { startedAt: number; receiving: boolean; downloaded?: number };

function formatElapsed(milliseconds: number) {
  return (milliseconds / 1000).toFixed(1) + ' s';
}

function PreviewLoading({ startedAt, receiving, downloaded }: PreviewProgress) {
  const [elapsed, setElapsed] = useState(() => performance.now() - startedAt);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(performance.now() - startedAt), 100);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const label = receiving ? 'Downloading PDF…' : 'Waiting for TexCompiler…';
  return (
    <div className="sr-loading-overlay">
      <div className="pdf-preview-progress">
        <strong role="status">{label}</strong>
        <progress aria-label={label} max={100} value={downloaded} />
        <span>Elapsed {formatElapsed(elapsed)}{downloaded !== undefined ? ` · ${downloaded}% downloaded` : ''}</span>
      </div>
    </div>
  );
}

export default function LivePdfPreview({
  jsonPayload,
  previewType = 'resume',
  includePhoto = false,
  canCompile = true,
  fileLabel,
  onToggleType,
  onTogglePhoto
}: LivePdfPreviewProps) {
  const [progress, setProgress] = useState<PreviewProgress | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const isLoading = progress !== null;
  const [savingFolder, setSavingFolder] = useState(false);
  const { settings } = useSettings();
  const [pdfUrl, setPdfUrl] = useState('');
  const [compileError, setCompileError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [compiledInput, setCompiledInput] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const attemptedInitial = useRef(false);
  const [localIncludePhoto, setLocalIncludePhoto] = useState(includePhoto);
  const compileInput = useMemo(
    () => JSON.stringify({ config: jsonPayload, type: previewType, include_photo: localIncludePhoto }),
    [jsonPayload, previewType, localIncludePhoto],
  );
  const isDirty = Boolean(compiledInput && compiledInput !== compileInput);

  useEffect(() => {
    setLocalIncludePhoto(includePhoto);
  }, [includePhoto]);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
    attemptedInitial.current = false;
  }, []);

  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const getDownloadName = () => {
    const config = typeof jsonPayload === 'string' ? JSON.parse(jsonPayload) : jsonPayload;
    const prefix = (settings.file_name_prefix || 'RESUME').replace(/[-_\s]+$/, '');
    const title = fileLabel?.trim() || [
      config?.role || config?.title || config?.job_title || config?.role_title,
      config?.company || config?.company_name || config?.name,
    ].filter(Boolean).join('_');
    const suffix = previewType === 'cover_letter' ? 'COVER_LETTER' : '';
    const stem = [prefix, title, suffix].filter(Boolean).join('_')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
    return { config, filename: `${stem || 'RESUME'}.pdf` };
  };

  const handleSaveToExportFolder = async () => {
    if (savingFolder || isLoading || !canCompile || !jsonPayload) return;
    setExportNotice('');
    setSavingFolder(true);
    try {
      const { config, filename } = getDownloadName();
      const { path } = await api.exportPdfLocal(config, filename, previewType, localIncludePhoto);
      setExportNotice(`PDF saved to the server folder at ${path}.`);
    } catch (error) {
      setExportNotice('Could not save the PDF to the server folder. ' + (error as Error).message);
    } finally {
      setSavingFolder(false);
    }
  };

  const handleCompile = useCallback(async () => {
    if (!canCompile || !jsonPayload || requestRef.current || savingFolder) return;
    const controller = new AbortController();
    const startedAt = performance.now();
    requestRef.current = controller;
    setProgress({ startedAt, receiving: false });
    setLastDuration(null);
    setCompileError('');
    try {
      const body = JSON.parse(compileInput);
      if (typeof body.config === 'string') body.config = JSON.parse(body.config);
      const response = await fetch('/api/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 401) redirectToSignIn();
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Could not generate the PDF.');
      }
      if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/pdf') {
        throw new Error('The preview service did not return a PDF.');
      }
      const contentLength = Number(response.headers.get('Content-Length'));
      const trackDownload = Number.isSafeInteger(contentLength) && contentLength > 0 &&
        !response.headers.get('Content-Encoding');
      const stream = response.body;
      setProgress({ startedAt, receiving: true, downloaded: stream && trackDownload ? 0 : undefined });
      let received = 0;
      let lastPercent = 0;
      let blob: Blob;
      if (stream && trackDownload) {
        const counted = stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, output) {
            received += chunk.byteLength;
            const percent = Math.min(100, Math.floor(received / contentLength * 100));
            if (percent !== lastPercent && !controller.signal.aborted) {
              lastPercent = percent;
              setProgress({ startedAt, receiving: true, downloaded: percent });
            }
            output.enqueue(chunk);
          },
        }));
        blob = await new Response(counted, {
          headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/pdf' },
        }).blob();
      } else {
        blob = await response.blob();
      }
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setCompiledInput(compileInput);
      return url;
    } catch (error) {
      if (!controller.signal.aborted) setCompileError((error as Error).message);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setProgress(null);
        setLastDuration(performance.now() - startedAt);
      }
    }
    return undefined;
  }, [canCompile, compileInput, jsonPayload, savingFolder]);

  const handleDownload = async () => {
    if (!canCompile || !jsonPayload || requestRef.current || savingFolder) return;
    setExportNotice('');
    try {
      const { filename } = getDownloadName();
      const url = compiledInput === compileInput && pdfUrl ? pdfUrl : await handleCompile();
      if (!url) return;
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setExportNotice(`Download started for ${filename}.`);
    } catch (error) {
      setExportNotice('Could not download the PDF. ' + (error as Error).message);
    }
  };

  useEffect(() => {
    if (canCompile && jsonPayload && !attemptedInitial.current) {
      attemptedInitial.current = true;
      void handleCompile();
    }
  }, [canCompile, jsonPayload, handleCompile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (canCompile && (event.ctrlKey || event.metaKey) && event.key === 'Enter' && !requestRef.current) {
        event.preventDefault();
        void handleCompile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canCompile, handleCompile]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>description</span> 
            Live PDF Preview
          </span>
          {isDirty && (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              background: 'rgba(234, 179, 8, 0.2)',
              color: 'var(--warning)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(234, 179, 8, 0.4)'
            }}>
              Uncompiled changes
            </span>
          )}
        </div>

        {/* Toggle options */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            style={{ 
              fontSize: '10px', 
              padding: '4px 10px', 
              background: previewType === 'resume' ? 'var(--accent)' : 'transparent', 
              color: previewType === 'resume' ? 'white' : 'var(--text-muted)' 
            }}
            onClick={() => onToggleType?.('resume')}
            aria-pressed={previewType === 'resume'}
            hidden={!onToggleType}
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
            onClick={() => onToggleType?.('cover_letter')}
            aria-pressed={previewType === 'cover_letter'}
            hidden={!onToggleType}
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
            aria-pressed={localIncludePhoto}
            title="Include photo in compilation"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>photo_camera</span>
            Photo
          </button>

          <button 
            className={`btn ${isDirty ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={handleCompile}
            disabled={!canCompile || isLoading || savingFolder || !jsonPayload}
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: isDirty ? '0 0 8px rgba(99, 102, 241, 0.5)' : 'none'
            }}
            title="Compile LaTeX PDF (Ctrl+Enter)"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>play_arrow</span> Compile
          </button>

          <button 
            className="btn btn-primary btn-sm"
            onClick={handleDownload}
            disabled={!canCompile || isLoading || savingFolder || !jsonPayload}
            style={{ padding: '4px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
            title="Download PDF to this device"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>save</span> Save PDF
          </button>
          {settings.export_folder && (
            <button className="btn btn-secondary btn-sm" onClick={handleSaveToExportFolder}
              disabled={!canCompile || isLoading || savingFolder || !jsonPayload}>
              {savingFolder ? 'Saving to server…' : 'Save to server folder'}
            </button>
          )}
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
        {progress && <PreviewLoading {...progress} />}

        {compileError && (
          <div className="pdf-preview-error" role="alert">
            <p>{compileError}</p>
            {lastDuration !== null && <p>Failed after {formatElapsed(lastDuration)}</p>}
            <button className="btn btn-secondary btn-sm" disabled={!canCompile || isLoading} onClick={handleCompile}>Retry Compilation</button>
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

      {!isLoading && !compileError && lastDuration !== null && (
        <p className="editor-notice" role="status">PDF ready in {formatElapsed(lastDuration)}</p>
      )}
      {exportNotice && <p className="editor-notice" role="status">{exportNotice}</p>}
    </div>
  );
}
