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
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
