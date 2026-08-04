import { defineConfig, devices } from '@playwright/test';

// Vera's own port, distinct from the other apps and from any stray dev server.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4320);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: baseURL,
    // Never adopt a server this config did not start: another app answering on
    // the port would be tested silently, passing or failing for reasons that
    // have nothing to do with Vera.
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      // Auth.js rebuilds request URLs from AUTH_URL; left at the .env value it
      // would redirect the browser off this app mid-test.
      AUTH_URL: baseURL,
      NEXTAUTH_URL: baseURL,
      // Build away from `.next`, so a suite run cannot invalidate a dev server.
      NEXT_DIST_DIR: '.next-e2e',
    },
    timeout: 600_000,
  },
});
