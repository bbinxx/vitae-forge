import React, { useEffect, useRef, useState } from 'react';

let editorAssets: Promise<any> | undefined;

function loadEditor() {
  if (!editorAssets) {
    const base = 'https://cdnjs.cloudflare.com/ajax/libs/jsoneditor/9.10.5/jsoneditor.min';
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = base + '.css';
    document.head.append(stylesheet);
    editorAssets = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = base + '.js';
      script.onload = () => resolve((window as any).JSONEditor);
      script.onerror = reject;
      document.head.append(script);
    });
  }
  return editorAssets;
}

interface JsonEditorProps {
  value: any;
  onChange: (value: any) => void;
  onEdit?: () => void;
  onValidityChange?: (valid: boolean) => void;
}

export default function JsonEditor({ value, onChange, onEdit, onValidityChange }: JsonEditorProps) {
  const [Editor, setEditor] = useState(() => (window as any).JSONEditor);
  const [valid, setValid] = useState(true);
  const editedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<any>(null);
  const localValueRef = useRef<any>();
  const callbacksRef = useRef({ onChange, onEdit, onValidityChange });
  callbacksRef.current = { onChange, onEdit, onValidityChange };

  const handleText = (text: string) => {
    editedRef.current = true;
    const callbacks = callbacksRef.current;
    callbacks.onEdit?.();
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Resume data must be a JSON object');
      }
      localValueRef.current = parsed;
      setValid(true);
      callbacks.onValidityChange?.(true);
      callbacks.onChange(parsed);
    } catch {
      setValid(false);
      callbacks.onValidityChange?.(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!Editor) {
      loadEditor().then(editor => {
        if (mounted && editor && !editedRef.current) setEditor(() => editor);
      }).catch(() => {});
    }
    return () => { mounted = false; };
  }, [Editor]);

  useEffect(() => {
    if (!containerRef.current || !Editor) return;
    const editor = new Editor(containerRef.current, {
      mode: 'code',
      modes: ['code', 'tree', 'form'],
      onChangeText: handleText,
    });
    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [Editor]);

  useEffect(() => {
    if (localValueRef.current === value) return;
    editorRef.current?.set(value ?? {});
    if (textareaRef.current) {
      textareaRef.current.value = JSON.stringify(value ?? {}, null, 2);
    }
    setValid(true);
    callbacksRef.current.onValidityChange?.(true);
  }, [value, Editor]);

  return (
    <div className="resume-json-editor">
      {Editor ? (
        <div ref={containerRef} className="react-json-editor-container" />
      ) : (
        <textarea ref={textareaRef} className="input-field" aria-label="Resume JSON"
          aria-invalid={!valid} spellCheck={false} onChange={(event) => handleText(event.target.value)} />
      )}
      {!valid && <p className="editor-error" role="status">Fix the JSON before saving. Resume data must be a JSON object.</p>}
    </div>
  );
}
