// Adds DOM matchers (toBeInTheDocument, toHaveAttribute, ...) to Vitest's expect.
import '@testing-library/jest-dom/vitest';
// In-memory IndexedDB for jsdom, so Dexie works in tests exactly as in the browser.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { db } from '../db/db.ts';

// Every test starts from a freshly created database (with seeded categories),
// so tests never depend on each other's data.
beforeEach(async () => {
  await db.delete();
  await db.open();
});

// Vitest globals are off, so Testing Library can't auto-register its cleanup.
afterEach(() => {
  cleanup();
});
