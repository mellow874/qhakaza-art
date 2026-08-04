import { expect, signIn, test } from './fixtures';

/**
 * Phase 1, screen 1: an artist signs in, completes their storefront profile and
 * arrives at their dashboard.
 *
 * Every test gets its own account from the fixtures, so none of them depend on
 * seed data or on each other.
 */

test('an artist signs in and is taken to where they were headed', async ({ page, artist }) => {
  await page.goto('/artist/onboarding');

  // The fence bounced us to login, carrying the destination along.
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fartist%2Fonboarding/);

  await signIn(page, artist);

  await page.waitForURL(/\/artist\/onboarding/);
  await expect(page.getByRole('heading', { name: /storefront/i })).toBeVisible();
});

test('a new artist gets an empty form and a create-style action', async ({ page, artist }) => {
  await page.goto('/login?callbackUrl=%2Fartist%2Fonboarding');
  await signIn(page, artist);
  await page.waitForURL(/\/artist\/onboarding/);

  await expect(page.getByLabel('Display name')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('the form is prefilled for an artist who already has a profile', async ({
  page,
  artistWithProfile,
}) => {
  await page.goto('/login?callbackUrl=%2Fartist%2Fonboarding');
  await signIn(page, artistWithProfile);
  await page.waitForURL(/\/artist\/onboarding/);

  await expect(page.getByLabel('Display name')).toHaveValue('Thandi Mokoena');
  await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
});

test('an artist completes their profile and lands on the dashboard', async ({ page, artist }) => {
  await page.goto('/login?callbackUrl=%2Fartist%2Fonboarding');
  await signIn(page, artist);
  await page.waitForURL(/\/artist\/onboarding/);

  await page.getByLabel('Display name').fill('Sipho Ndlovu Studio');
  await page.getByLabel('Artist statement').fill('Linocut and reclaimed steel.');
  await page.getByLabel('Instagram').fill('https://instagram.com/sipho.studio');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL(/\/artist\/dashboard/);
});

test('the form refuses to submit without a display name', async ({ page, artistWithProfile }) => {
  await page.goto('/login?callbackUrl=%2Fartist%2Fonboarding');
  await signIn(page, artistWithProfile);
  await page.waitForURL(/\/artist\/onboarding/);

  await page.getByLabel('Display name').fill('');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page.getByText(/display name is required/i)).toBeVisible();
  await expect(page).toHaveURL(/\/artist\/onboarding/);
});

test('a social link that is not a URL is rejected', async ({ page, artist }) => {
  await page.goto('/login?callbackUrl=%2Fartist%2Fonboarding');
  await signIn(page, artist);
  await page.waitForURL(/\/artist\/onboarding/);

  await page.getByLabel('Display name').fill('Studio Ndlovu');
  await page.getByLabel('Website').fill('not-a-url');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText(/full url/i)).toBeVisible();
  await expect(page).toHaveURL(/\/artist\/onboarding/);
});

test('a collector cannot reach artist onboarding', async ({ page, collector }) => {
  await page.goto('/login?callbackUrl=%2Fartist%2Fonboarding');
  await signIn(page, collector);

  await page.waitForURL(/\/forbidden/);
});

test('wrong credentials are rejected without revealing which field was wrong', async ({
  page,
  artist,
}) => {
  await page.goto('/login');
  await signIn(page, { email: artist.email, password: 'definitely-not-the-password' });

  // Scoped to the form: Next.js renders its own route announcer with role="alert".
  const alert = page.locator('form').getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/email or password is incorrect/i);
  await expect(page).toHaveURL(/\/login/);
});
