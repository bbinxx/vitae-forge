import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5050',
      '/applications': 'http://127.0.0.1:5050',
      '/bookmarks': 'http://127.0.0.1:5050',
      '/compile-direct': 'http://127.0.0.1:5050',
      '/list-files': 'http://127.0.0.1:5050',
      '/get-config': 'http://127.0.0.1:5050',
      '/pdf': 'http://127.0.0.1:5050',
    },
  },
});
