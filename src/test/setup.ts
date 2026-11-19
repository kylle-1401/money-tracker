// Adds DOM matchers (toBeInTheDocument, toHaveAttribute, ...) to Vitest's expect.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest globals are off, so Testing Library can't auto-register its cleanup.
afterEach(() => {
  cleanup();
});
