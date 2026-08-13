import { expect, openNavIfCollapsed, test } from './fixtures';

/** The methodology page — a numbered sequence under the collector chrome. */

test('renders for an anonymous visitor', async ({ page }) => {
  const response = await page.goto('/collectors/methodology', { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Methodology' })).toBeVisible();
  await expect(page.getByText(/we come to know the collector/i)).toBeVisible();
});

test('lists the five steps in order', async ({ page }) => {
  await page.goto('/collectors/methodology', { waitUntil: 'domcontentloaded' });

  const steps = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(steps).toHaveCount(5);

  await expect(steps.getByRole('heading', { level: 2 })).toHaveText([
    'Collector first',
    'Intelligence before invitation',
    'Hospitality',
    'Discretion and scale',
    'Routes, not moments',
  ]);
});

test('the ordinals are decorative, not read out before each heading', async ({ page }) => {
  await page.goto('/collectors/methodology', { waitUntil: 'domcontentloaded' });

  // The <ol> already conveys order; "01" is visible but hidden from the a11y tree.
  await expect(page.getByText('01', { exact: true })).toHaveAttribute('aria-hidden', 'true');
});

test('closes with the essence statement and the membership action', async ({ page }) => {
  await page.goto('/collectors/methodology', { waitUntil: 'domcontentloaded' });

  const essence = page.getByRole('region', { name: /in essence/i });
  await expect(essence.getByText(/a private membership that offers collectors/i)).toBeVisible();

  // Membership, not onboarding: this button is about the fee, so it belongs to
  // the consideration flow rather than the intake.
  await expect(page.getByRole('link', { name: /apply for membership/i })).toHaveAttribute(
    'href',
    '/collectors/membership-consideration',
  );
});

test('wears the collector chrome, not the artist site’s', async ({ page }) => {
  await page.goto('/collectors/methodology', { waitUntil: 'domcontentloaded' });
  await openNavIfCollapsed(page);

  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Membership' }).first()).toBeVisible();
  await expect(header.getByRole('link', { name: 'Briefings' })).toHaveCount(0);

  const luminance = await page.evaluate(() => {
    const rgb = getComputedStyle(document.querySelector('.theme-light')!).backgroundColor;
    const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  });
  expect(luminance).toBeGreaterThan(200);
});

test('does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collectors/methodology', { waitUntil: 'domcontentloaded' });

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
