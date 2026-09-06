/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the project from /<repo-name>/, configurable via env
// so local dev and preview keep working at the root path.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
          turf: ['@turf/turf'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
