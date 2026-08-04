import { expect, test } from '@playwright/test';

/**
 * Phase 0 smoke test: the app boots, public routes are reachable without a
 * session, and every protected area bounces an anonymous visitor to login with
 * a callback URL back to where they were headed.
 */

test('the home page boots', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Qhakaza Art/);
});

test.describe('public routes are reachable without signing in', () => {
  for (const path of ['/', '/browse', '/artists', '/login', '/signup']) {
    test(`${path} is public`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(path);
    });
  }
});

test.describe('protected areas redirect anonymous visitors to login', () => {
  for (const path of ['/artist/dashboard', '/collector/favourites', '/admin']) {
    test(`${path} redirects to login`, async ({ page, baseURL }) => {
      await page.goto(path);

      const url = new URL(page.url());
      // The origin is asserted too: a redirect that leaves this app would
      // otherwise still satisfy a pathname-only check and pass silently.
      expect(url.origin).toBe(new URL(baseURL!).origin);
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('callbackUrl')).toBe(path);

      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    });
  }
});

test('the artists index is not mistaken for the fenced artist area', async ({ page }) => {
  const response = await page.goto('/artists');

  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/artists');
});
