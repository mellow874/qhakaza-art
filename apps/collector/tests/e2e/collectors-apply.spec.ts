import { expect, test, waitForFormHydration } from './fixtures';

/**
 * `/collectors/apply` — the collector intake. Every call to action on every
 * collector page ends here, so this journey being unbroken matters more than
 * any other on that sub-brand.
 */

const uniqueEmail = () =>
  `applicant-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;

/** The fields are controlled, so nothing may be typed before React mounts. */
async function openForm(page: Parameters<typeof waitForFormHydration>[0]) {
  await page.goto('/collectors/apply', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);
}

test('renders for an anonymous visitor', async ({ page }) => {
  const response = await page.goto('/collectors/apply', { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Begin Your Application' }),
  ).toBeVisible();
  await expect(page.getByText(/held privately/i)).toBeVisible();
});

test('is kept out of search results', async ({ request }) => {
  // An application form has no business being indexed.
  const html = await (await request.get('/collectors/apply')).text();
  expect(html).toMatch(/noindex/);
});

test('a collector can apply with only a name and an email', async ({ page }) => {
  await openForm(page);

  await page.getByLabel(/full name/i).fill('Thandi Mokoena');
  await page.getByLabel(/email address/i).fill(uniqueEmail());
  await page.getByRole('button', { name: /continue to verification/i }).click();

  await expect(page.getByRole('status')).toContainText(/received/i);
});

test('a collector can apply with everything filled in', async ({ page }) => {
  await openForm(page);

  await page.getByLabel(/full name/i).fill('Sipho Dube');
  await page.getByLabel(/email address/i).fill(uniqueEmail());
  await page.getByLabel(/phone/i).fill('+27 82 000 0000');
  await page.getByLabel(/country of residence/i).fill('South Africa');
  await page.getByLabel(/city/i).fill('Johannesburg');
  await page.getByLabel(/annual income band/i).selectOption({ index: 2 });
  await page.getByLabel(/liquid assets band/i).selectOption({ index: 3 });
  await page.getByLabel(/collecting goal/i).fill('To build a considered collection over time.');
  await page.getByLabel(/art exposure/i).fill('Two acquisitions, no advisor.');
  await page.getByRole('checkbox', { name: 'Painting' }).check();

  await page.getByRole('button', { name: /continue to verification/i }).click();

  await expect(page.getByRole('status')).toContainText(/received/i);
});

test('a missing name blocks the application and keeps the email', async ({ page }) => {
  await openForm(page);

  await page.getByLabel(/email address/i).fill('thandi@example.com');
  await page.getByRole('button', { name: /continue to verification/i }).click();

  await expect(page.getByText(/full name is required/i)).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByLabel(/email address/i)).toHaveValue('thandi@example.com');
});

test('every collector page leads here', async ({ page }) => {
  for (const from of [
    '/collectors',
    '/collectors/about',
    '/collectors/membership',
    '/collectors/methodology',
  ]) {
    await page.goto(from, { waitUntil: 'domcontentloaded' });

    // Each page must offer *a* collector journey; which one depends on the
    // page. The membership and methodology pages lead to consideration, the
    // rest to the intake.
    const journeys = page.locator(
      'main a[href="/collectors/apply"], main a[href="/collectors/request-access"], main a[href="/collectors/membership-consideration"]',
    );
    expect(await journeys.count(), `${from} offers no collector journey`).toBeGreaterThan(0);

    await journeys.first().click();
    await expect(page).toHaveURL(/\/collectors\/(apply|request-access|membership-consideration)$/);
  }
});

test('does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collectors/apply', { waitUntil: 'domcontentloaded' });

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
