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
    projects: [
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true, alias: sharedPackageAliases },
        test: {
          name: 'command:unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/*.db.test.ts', 'node_modules', '.next', 'tests/e2e'],
        },
      },
      {
        resolve: { tsconfigPaths: true, alias: sharedPackageAliases },
        test: {
          name: 'command:integration',
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
