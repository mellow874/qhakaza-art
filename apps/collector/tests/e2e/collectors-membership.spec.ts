import { expect, openNavIfCollapsed, test } from './fixtures';

/** `/collectors/membership` — the Founding Circle offer. */

test('renders for an anonymous visitor', async ({ page }) => {
  const response = await page.goto('/collectors/membership', { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'A Private Social Club Centered Around African Art Collecting',
    }),
  ).toBeVisible();
});

test('states the price, the period and what it is for', async ({ page }) => {
  await page.goto('/collectors/membership', { waitUntil: 'domcontentloaded' });

  // The figure and its period must read as one statement — "$10,000" alone
  // would be a different claim from "$10,000 / year".
  const price = page.getByText(/\$10,000\s*\/ year/);
  await expect(price).toBeVisible();
  await expect(price).toContainText(/annual membership consideration/i);

  await expect(
    page.getByText(/a serious, guided route into African contemporary art/i),
  ).toBeVisible();
});

test('lists everything membership includes', async ({ page }) => {
  await page.goto('/collectors/membership', { waitUntil: 'domcontentloaded' });

  for (const item of [
    /collector intelligence on selected African contemporary artists/i,
    /prepared access to artists, galleries, studios/i,
    /private experiences shaped around meaningful collecting/i,
    /collection formation support/i,
    /a more private social world/i,
  ]) {
    await expect(page.getByText(item)).toBeVisible();
  }
});

test('sets out the annual rhythm and how access is considered', async ({ page }) => {
  await page.goto('/collectors/membership', { waitUntil: 'domcontentloaded' });

  const rhythm = page.getByRole('region', { name: /the annual collector rhythm/i });
  await expect(rhythm.getByRole('listitem')).toHaveCount(5);
  await expect(rhythm.getByText('A principal annual gathering')).toBeVisible();

  const access = page.getByRole('region', { name: /how access is considered/i });
  await expect(access.getByText(/begins with a short collector intake/i)).toBeVisible();
});

test('both requests lead to consideration, not to a checkout or the intake', async ({ page }) => {
  await page.goto('/collectors/membership', { waitUntil: 'domcontentloaded' });

  const requests = page.getByRole('link', { name: /request membership consideration/i });
  await expect(requests).toHaveCount(2);
  for (const href of await requests.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')),
  )) {
    // Not /collectors/apply: someone who cannot meet the fee should not be
    // dropped into full onboarding, which asks for their income band.
    expect(href).toBe('/collectors/membership-consideration');
  }

  await expect(
    page.getByRole('heading', { name: /the route begins with a conversation, not a checkout/i }),
  ).toBeVisible();
});

test('marks Membership as the current page in the navigation', async ({ page }) => {
  await page.goto('/collectors/membership', { waitUntil: 'domcontentloaded' });
  await openNavIfCollapsed(page);

  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Membership' }).first(),
  ).toHaveAttribute('aria-current', 'page');
});

test('does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collectors/membership', { waitUntil: 'domcontentloaded' });

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
