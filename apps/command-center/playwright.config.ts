import { defineConfig, devices } from '@playwright/test';

// The collector app's own port, distinct from the other apps.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4322);
const baseURL = `http://127.0.0.1:${PORT}`;

/*
 * E2E runs against the LOCAL test database, never the live one.
 *
 * The app `.env` files point at Supabase so the dev servers and the demo use
 * it — but a suite that creates and deletes accounts must not do that against
 * production data, and a remote pooled connection adds enough latency under
 * parallel workers to fail on timing rather than on behaviour.
 *
 * Set on `process.env` as well as on `webServer.env` because both halves need
 * it: the app under test reads the latter, and the fixtures (which seed and
 * tear down) run in this process. `dotenv` does not overwrite variables that
 * are already set, so doing it here wins over the `.env` file.
 */
const TEST_DATABASE =
  process.env.E2E_DATABASE_URL ??
  'postgresql://qhakaza_app:qhakaza_app@localhost:5433/qhakaza_art_test?schema=public';
const TEST_DATABASE_OWNER =
  process.env.E2E_DIRECT_DATABASE_URL ??
  'postgresql://qhakaza:qhakaza@localhost:5433/qhakaza_art_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE;
process.env.DIRECT_DATABASE_URL = TEST_DATABASE_OWNER;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 60_000,
  // 20s, not the 10s default. Several suites and builds share one machine, and
  // a first server-action round trip can exceed 10s under that load — which
  // failed on contention rather than on anything the app did. A genuine hang is
  // still caught.
  expect: { timeout: 20_000 },
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
    // The Command Center has no public root; poll the sign-in page.
    url: `${baseURL}/login`,
    // Never adopt a server this config did not start: another app answering on
    // the port would be tested silently, passing or failing for reasons that
    // have nothing to do with this app.
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      // Auth.js rebuilds request URLs from AUTH_URL; left at the .env value it
      // would redirect the browser off this app mid-test.
      AUTH_URL: baseURL,
      NEXTAUTH_URL: baseURL,
      // Build away from `.next`, so a suite run cannot invalidate a dev server.
      NEXT_DIST_DIR: '.next-e2e',
      DATABASE_URL: TEST_DATABASE,
      DIRECT_DATABASE_URL: TEST_DATABASE_OWNER,
    },
    timeout: 600_000,
  },
});
