/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the built app works under any GitHub Pages path
  // (https://<user>.github.io/<repo>/) without hard-coding the repo name.
  // Safe because routing is hash-based (HashRouter), so every page is served from index.html.
  base: './',
  build: {
    // One ~160 KB (gzipped) bundle is fine here: it is downloaded once and then served
    // offline from the service worker, so splitting it buys little. Revisit if it
    // passes ~700 KB unminified.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
