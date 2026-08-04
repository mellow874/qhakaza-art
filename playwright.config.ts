import { defineConfig, devices } from '@playwright/test';

// A distinctive port, so a stray dev server from another project on 3000/3100
// cannot be mistaken for this app.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4319);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Several browsers, a Next server and Postgres share one machine here. The
  // default 30s is enough for the app but not always for the contention, and a
  // timeout that fires under load reads as a bug when it is not one.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The collector experience has to be excellent on mobile, so it is tested there too.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: baseURL,
    // Never adopt a server this config did not start: a foreign app answering
    // on the port would otherwise be tested silently, and pass or fail for
    // reasons that have nothing to do with this codebase.
    reuseExistingServer: false,
    env: {
      // Next reads PORT directly, which is less brittle than threading `--port`
      // through `npm run … --`.
      PORT: String(PORT),
      // Auth.js rebuilds request URLs from AUTH_URL. Left at the .env value it
      // would redirect the browser to :3000 mid-test, off this app entirely.
      AUTH_URL: baseURL,
      NEXTAUTH_URL: baseURL,
      // Build somewhere other than `.next`, so running the suite cannot
      // invalidate a dev server someone has open. See next.config.ts.
      NEXT_DIST_DIR: '.next-e2e',
    },
    // A cold production build plus server start. Generous, because a timeout
    // here reports as a suite-wide failure and tells you nothing about the app.
    timeout: 600_000,
  },
});
