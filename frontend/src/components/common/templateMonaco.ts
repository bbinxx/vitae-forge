/// <reference types="vite/client" />

import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';

globalThis.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

monaco.languages.register({ id: 'latex' });
monaco.languages.setMonarchTokensProvider('latex', {
  tokenizer: {
    root: [
      [/\\[A-Za-z@]+|\\./, 'keyword'],
      [/%.*$/, 'comment'],
      [/\$+/, 'delimiter'],
      [/[{}[\]]/, '@brackets'],
    ],
  },
});

export default monaco;
