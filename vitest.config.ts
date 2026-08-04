import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Two projects:
 *
 * - `unit`        jsdom. Pure logic and React component tests. No database.
 * - `integration` node. Server actions run against the real test database on
 *                 :5433 (`npm run db:up`). Files are named `*.db.test.ts` so it
 *                 is obvious at a glance which tests need Postgres running.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
    },
    projects: [
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/*.db.test.ts', 'node_modules', '.next', 'tests/e2e'],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          setupFiles: ['./vitest.setup.integration.ts'],
          include: ['src/**/*.db.test.ts'],
          exclude: ['node_modules', '.next', 'tests/e2e'],
          // These share one Postgres database, so they must not race each other.
          fileParallelism: false,
        },
      },
    ],
  },
});
