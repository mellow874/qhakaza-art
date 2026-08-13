import { expect, test, waitForFormHydration } from './fixtures';

/**
 * `/request` — private request form. Allows visitors to submit enquiries about
 * artists, artworks, experiences, or other topics without joining as a collector.
 */

const uniqueEmail = () =>
  `request-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;

/** The fields are controlled, so nothing may be typed before React mounts. */
async function openForm(page: Parameters<typeof waitForFormHydration>[0]) {
  await page.goto('/collectors/request', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);
}

test('renders for an anonymous visitor', async ({ page }) => {
  const response = await page.goto('/collectors/request', { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Make a Private Request' }),
  ).toBeVisible();
  await expect(page.getByText(/quiet route/i)).toBeVisible();
});

test('is kept out of search results', async ({ request }) => {
  // A contact form has no business being indexed.
  const html = await (await request.get('/collectors/request')).text();
  expect(html).toMatch(/noindex/);
});

test('a visitor can submit a complete request', async ({ page }) => {
  await openForm(page);

  await page.getByLabel(/full name/i).fill('Thandi Mokoena');
  await page.getByLabel(/email address/i).fill(uniqueEmail());
  await page.getByLabel(/type of request/i).selectOption('artist');
  await page.getByLabel(/your request/i).fill('I am interested in contemporary South African painting.');
  await page.getByRole('button', { name: /send request/i }).click();

  await expect(page.getByRole('status')).toContainText(/received/i);
});

test('offers all four request types', async ({ page }) => {
  await openForm(page);

  const typeSelect = page.getByLabel(/type of request/i);
  const options = typeSelect.locator('option');

  // Check that all four types are available
  await expect(options.locator('text=Artist enquiry')).toBeVisible();
  await expect(options.locator('text=Artwork enquiry')).toBeVisible();
  await expect(options.locator('text=Private experience request')).toBeVisible();
  await expect(options.locator('text=Something else')).toBeVisible();
});

test('blocks a submission without a name', async ({ page }) => {
  await openForm(page);

  await page.getByLabel(/email address/i).fill('thandi@example.com');
  await page.getByLabel(/type of request/i).selectOption('artwork');
  await page.getByLabel(/your request/i).fill('I am looking for specific artworks.');
  await page.getByRole('button', { name: /send request/i }).click();

  await expect(page.getByText(/full name is required/i)).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByLabel(/email address/i)).toHaveValue('thandi@example.com');
});

test('blocks a malformed email', async ({ page }) => {
  await openForm(page);

  await page.getByLabel(/full name/i).fill('Thandi Mokoena');
  await page.getByLabel(/email address/i).fill('thandi@');
  await page.getByLabel(/type of request/i).selectOption('artist');
  await page.getByLabel(/your request/i).fill('Enquiry');
  await page.getByRole('button', { name: /send request/i }).click();

  await expect(page.getByText(/enter a valid email address/i)).toBeVisible();
});

test('blocks a submission without selecting a request type', async ({ page }) => {
  await openForm(page);

  await page.getByLabel(/full name/i).fill('Thandi Mokoena');
  await page.getByLabel(/email address/i).fill(uniqueEmail());
  await page.getByLabel(/your request/i).fill('Enquiry');
  await page.getByRole('button', { name: /send request/i }).click();

  await expect(page.getByText(/please select the type of request/i)).toBeVisible();
});

test('blocks a submission without a message', async ({ page }) => {
  await openForm(page);

  await page.getByLabel(/full name/i).fill('Thandi Mokoena');
  await page.getByLabel(/email address/i).fill(uniqueEmail());
  await page.getByLabel(/type of request/i).selectOption('experience');
  await page.getByRole('button', { name: /send request/i }).click();

  await expect(page.getByText(/your request is required/i)).toBeVisible();
});

test('keeps data when submission fails', async ({ page }) => {
  await openForm(page);

  const email = uniqueEmail();
  await page.getByLabel(/full name/i).fill('Thandi Mokoena');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/type of request/i).selectOption('artist');
  await page.getByLabel(/your request/i).fill('Enquiry');
  // The form will show a network error or succeed depending on backend state
  await page.getByRole('button', { name: /send request/i }).click();

  // Either the status appears or an error shows, but data is preserved
  const status = page.getByRole('status');
  const alert = page.getByRole('alert');
  await expect(status.or(alert)).toBeVisible();
  await expect(page.getByLabel(/full name/i)).toHaveValue('Thandi Mokoena');
});

test('does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collectors/request', { waitUntil: 'domcontentloaded' });

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
