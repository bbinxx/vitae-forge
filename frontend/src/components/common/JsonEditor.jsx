import React, { useEffect, useRef } from 'react';

export default function JsonEditor({ value, onChange }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const isLocalUpdateRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !window.JSONEditor) return;

    const options = {
      mode: 'code',
      modes: ['code', 'tree', 'form'],
      onChangeText: (text) => {
        try {
          const parsed = JSON.parse(text);
          isLocalUpdateRef.current = true;
          if (onChange) {
            onChange(parsed);
          }
        } catch (e) {
          // Ignore invalid JSON typing states
        }
      }
    };

    editorRef.current = new window.JSONEditor(containerRef.current, options);
    
    if (value) {
      editorRef.current.set(value);
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  // Update editor value if changed from outside props
  useEffect(() => {
    if (editorRef.current && value) {
      if (isLocalUpdateRef.current) {
        isLocalUpdateRef.current = false;
        return;
      }
      try {
        const currentVal = editorRef.current.get();
        if (JSON.stringify(currentVal) !== JSON.stringify(value)) {
          editorRef.current.set(value);
        }
      } catch (e) {
        // Fallback update if editor is currently in invalid text state
        try {
          editorRef.current.set(value);
        } catch (err) {}
      }
    }
  }, [value]);

  return (
    <div 
      ref={containerRef} 
      style={{ flex: 1, width: '100%', height: '100%', minHeight: 0 }}
      className="react-json-editor-container"
    />
  );
}
