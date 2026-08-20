import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const resolvePackage = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src`, import.meta.url));

/**
 * Resolve the shared packages to their TypeScript source, matching what
 * `transpilePackages` does for the Next build. Without this the workspace
 * symlink wins and Vitest externalises the package, at which point next-auth
 * loads under Node's own ESM resolution and its `next/server` import fails.
 */
const sharedPackageAliases = {
  '@qhakaza/shared-db': resolvePackage('shared-db'),
  '@qhakaza/shared-auth': resolvePackage('shared-auth'),
  '@qhakaza/shared-ui': resolvePackage('shared-ui'),
};

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true, alias: sharedPackageAliases },
  test: {
  /*
   * THREADS, NOT FORKS.
   *
   * The default `forks` pool starts a new process per worker. Spinning up jsdom
   * that way costs about a minute on a loaded machine, and when the unit and
   * integration projects run together the jsdom workers were timing out during
   * startup - after which vitest reported only the project that finished and
   * still exited 0.
   *
   * That is the dangerous part: `npm test` was quietly reporting 42 tests when
   * there are 77, and a genuine failure could have hidden the same way. Threads
   * share the process and start fast enough that both projects complete.
   */
  pool: 'threads',
    projects: [
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true, alias: sharedPackageAliases },
        test: {
          name: 'collector:unit',
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
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/*.db.test.ts', 'node_modules', '.next', 'tests/e2e'],
        },
      },
      {
        resolve: { tsconfigPaths: true, alias: sharedPackageAliases },
        test: {
          name: 'collector:integration',
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
