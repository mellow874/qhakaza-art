import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const resolvePackage = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src`, import.meta.url));

/**
 * Resolve the shared packages to their TypeScript source.
 *
 * Without this, `@qhakaza/shared-auth` matches the workspace symlink in
 * node_modules first and Vitest externalises it — the module then loads under
 * Node's own ESM resolution, where next-auth's `next/server` import fails. The
 * aliases keep the packages compiled from source, which is exactly what
 * `transpilePackages` does for the Next build.
 */
const sharedPackageAliases = {
  '@qhakaza/shared-db': resolvePackage('shared-db'),
  '@qhakaza/shared-auth': resolvePackage('shared-auth'),
  '@qhakaza/shared-ui': resolvePackage('shared-ui'),
  '@qhakaza/shared-email': resolvePackage('shared-email'),
  '@qhakaza/shared-storage': resolvePackage('shared-storage'),
};

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
    alias: sharedPackageAliases,
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
    projects: [
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true, alias: sharedPackageAliases },
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          /*
           * Well above the 5s default. These are plain jsdom renders, but a
           * userEvent-driven form test lands at 5-7s when several suites run
           * back to back on one machine -- so the default was failing on
           * contention, not on anything the code did. Timing out at 15s still
           * catches a genuine hang.
           */
          testTimeout: 15_000,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}', 'packages/*/src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/*.db.test.ts', 'node_modules', '.next', 'tests/e2e'],
        },
      },
      {
        resolve: { tsconfigPaths: true, alias: sharedPackageAliases },
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          setupFiles: ['./vitest.setup.integration.ts'],
          include: ['src/**/*.db.test.ts', 'packages/*/src/**/*.db.test.ts'],
          exclude: ['node_modules', '.next', 'tests/e2e'],
          // These share one Postgres database, so they must not race each other.
          fileParallelism: false,
        },
      },
    ],
  },
});
