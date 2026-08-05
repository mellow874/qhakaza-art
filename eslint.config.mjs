import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Turns off stylistic rules that Prettier owns.
  prettier,
  {
    rules: {
      // The workspace root is no longer a Next application -- it lints the
      // shared packages and scripts. This rule looks for a pages/ directory
      // that will never exist here and warns on every run.
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Playwright fixtures take a callback named `use`, which the React Hooks
    // rule mistakes for the `use` hook. There is no React here.
    files: ['tests/e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  globalIgnores([
    'apps/**',
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
