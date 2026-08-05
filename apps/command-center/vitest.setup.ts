import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Next.js server components and next/navigation are not available in jsdom;
// component tests stub what they need per-file.
process.env.AUTH_SECRET ??= 'test-secret-not-used-in-production';
process.env.DATABASE_URL ??= 'postgresql://qhakaza:qhakaza@localhost:5433/qhakaza_art_test';
