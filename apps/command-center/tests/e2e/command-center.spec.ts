import { expect, signIn, test, waitForFormHydration } from './fixtures';

/**
 * The Command Center door. Everything behind it is covered by integration
 * tests against the real database; what matters here is who gets through.
 */

test('an anonymous visitor is sent to sign in, seeing nothing', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /qhakaza operations/i })).toHaveCount(0);
});

test('a signed-in artist is refused and sees no operational data', async ({ page, artist }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);
  await signIn(page, artist);

  await expect(page.getByRole('heading', { name: /not available/i })).toBeVisible();

  // None of the console's panels render — not even empty ones.
  for (const panel of [/verification/i, /collector intake/i, /audit trail/i, /permissions/i]) {
    await expect(page.getByRole('heading', { name: panel })).toHaveCount(0);
  }
});

test('a signed-in collector is refused', async ({ page, collector }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);
  await signIn(page, collector);

  await expect(page.getByRole('heading', { name: /not available/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /qhakaza operations/i })).toHaveCount(0);
});

test('an admin reaches the console and every panel is present', async ({ page, admin }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);
  await signIn(page, admin);

  await expect(page.getByRole('heading', { level: 1, name: /qhakaza operations/i })).toBeVisible();

  for (const panel of [
    /verification & vetting/i,
    /collector intake/i,
    /communications/i,
    /analytics & reporting/i,
    /access & permissions/i,
    /audit trail/i,
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: panel })).toBeVisible();
  }
});

test('an advisor reaches the console but cannot change roles', async ({ page, advisor }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);
  await signIn(page, advisor);

  await expect(page.getByRole('heading', { level: 1, name: /qhakaza operations/i })).toBeVisible();
  await expect(page.getByText(/advisors can see roles but not change them/i)).toBeVisible();
});

test('the console is never indexed', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/Disallow:\s*\//);
});
