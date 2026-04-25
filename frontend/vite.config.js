import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
