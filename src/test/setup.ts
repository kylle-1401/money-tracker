// Adds DOM matchers (toBeInTheDocument, toHaveAttribute, ...) to Vitest's expect.
import '@testing-library/jest-dom/vitest';
// In-memory IndexedDB for jsdom, so Dexie works in tests exactly as in the browser.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { db } from '../db/db.ts';
import { dismissBudgetAlerts } from '../features/budget/budgetAlerts.ts';

// findBy*/waitFor give up after 1s by default. Pages wait on several IndexedDB live
// queries, and on a slow or busy machine (CI) that can take longer; one flaky
// timeout was seen locally. Fast runs are unaffected: lookups return as soon as found.
configure({ asyncUtilTimeout: 3000 });

// Every test starts from a freshly created database (with seeded categories),
// so tests never depend on each other's data.
beforeEach(async () => {
  await db.delete();
  await db.open();
});

// Vitest globals are off, so Testing Library can't auto-register its cleanup.
afterEach(() => {
  cleanup();
  // The budget alert store lives in module memory; don't leak alerts between tests.
  dismissBudgetAlerts();
});
