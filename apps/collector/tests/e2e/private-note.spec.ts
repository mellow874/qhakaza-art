import { expect, prisma, test, waitForFormHydration } from './fixtures';

/** The Private Note — a standalone RSVP for prospective collectors. */

const uniqueEmail = () => `note-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;

test.afterEach(async () => {
  await prisma.privateNote.deleteMany({ where: { email: { contains: '@test.local' } } });
});

test('has its own route and is not indexed', async ({ page, request }) => {
  const response = await page.goto('/collectors/private-note', { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'The Private Note' })).toBeVisible();

  // Personal answers have no business in a search index.
  const html = await (await request.get('/collectors/private-note')).text();
  expect(html).toMatch(/noindex/);
});

test('is offered at the end of the intake, which is the moment it is for', async ({ page }) => {
  await page.goto('/collectors/apply', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);

  await page.getByLabel(/full name/i).fill('Thandi Mokoena');
  await page.getByLabel(/email address/i).fill(uniqueEmail());
  await page.getByRole('button', { name: /continue to verification/i }).click();

  const done = page.getByRole('status');
  await expect(done).toContainText(/received/i);
  await expect(done.getByRole('link', { name: /write your private note/i })).toHaveAttribute(
    'href',
    '/collectors/private-note',
  );
});

test('carries an audio control', async ({ page }) => {
  await page.goto('/collectors/private-note', { waitUntil: 'domcontentloaded' });

  /*
   * No track has been supplied yet, so the player renders its labelled
   * unavailable state rather than an <audio> pointing at a 404. Once the file
   * is added and `privateNote.audio.src` is set, the play control appears — so
   * this asserts one of the two, not the placeholder forever.
   */
  const player = page.getByText(/a note to sit with/i);
  await expect(player).toBeVisible();

  const hasControl = (await page.getByRole('button', { name: /play music/i }).count()) > 0;
  const hasPlaceholder = (await page.getByText(/music will play here/i).count()) > 0;
  expect(hasControl || hasPlaceholder).toBe(true);
});

test('asks about interests, preferences and how we can serve', async ({ page }) => {
  await page.goto('/collectors/private-note', { waitUntil: 'domcontentloaded' });

  for (const heading of [
    /what you are drawn to/i,
    /how you prefer to collect/i,
    /how we can serve you/i,
  ]) {
    await expect(page.getByText(heading).first()).toBeVisible();
  }

  await expect(page.getByLabel(/acquisition pace/i)).toBeVisible();
  await expect(page.getByLabel(/typical range per work/i)).toBeVisible();
  await expect(page.getByLabel(/what are you building/i)).toBeVisible();
});

test('a prospective collector can write one, and it is stored', async ({ page }) => {
  const email = uniqueEmail();

  await page.goto('/collectors/private-note', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);

  await page.getByLabel(/full name/i).fill('Lerato Dube');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole('checkbox', { name: 'Painting' }).check();
  await page.getByRole('checkbox', { name: 'Southern Africa' }).check();
  await page.getByLabel(/acquisition pace/i).selectOption('STEADY');
  await page.getByLabel(/what are you building/i).fill('A room I can live with for decades.');

  await page.getByRole('button', { name: /send my note/i }).click();

  await expect(page.getByRole('status')).toContainText(/thank you/i);

  const note = await prisma.privateNote.findFirst({ where: { email } });
  expect(note).not.toBeNull();
  expect(note!.mediums).toContain('Painting');
  expect(note!.regions).toContain('Southern Africa');
  expect(note!.acquisitionPace).toBe('STEADY');
  // Consent was never ticked, so it must be false.
  expect(note!.mayContact).toBe(false);
});

test('a note with only a name and an email is accepted', async ({ page }) => {
  const email = uniqueEmail();

  await page.goto('/collectors/private-note', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);

  await page.getByLabel(/full name/i).fill('Sipho Dube');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole('button', { name: /send my note/i }).click();

  await expect(page.getByRole('status')).toContainText(/thank you/i);
  expect(await prisma.privateNote.count({ where: { email } })).toBe(1);
});

test('a missing name blocks the note and keeps what was typed', async ({ page }) => {
  await page.goto('/collectors/private-note', { waitUntil: 'domcontentloaded' });
  await waitForFormHydration(page);

  await page.getByLabel(/email address/i).fill('thandi@test.local');
  await page.getByRole('button', { name: /send my note/i }).click();

  await expect(page.getByText(/full name is required/i)).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByLabel(/email address/i)).toHaveValue('thandi@test.local');
});

test('does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collectors/private-note', { waitUntil: 'domcontentloaded' });

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
