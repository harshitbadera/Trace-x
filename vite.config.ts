import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'submission' ? [viteSingleFile()] : [])],
  server: {
    port: Number(process.env.VITE_PORT || 5173),
    strictPort: true,
    proxy: { '/api': process.env.TRACE_API_URL || 'http://127.0.0.1:8000' },
  },
  build: { outDir: mode === 'submission' ? 'submission' : 'dist', chunkSizeWarningLimit: 1800 },
}));
