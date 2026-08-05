import { expect, openNavIfCollapsed, test } from './fixtures';

/** The collector About page — dark hero, mission, story, structure, intake. */

test('renders for an anonymous visitor', async ({ page }) => {
  const response = await page.goto('/collectors/about', { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'A Private Gateway into African Art' }),
  ).toBeVisible();
  await expect(page.getByText(/collectors deserve serious intelligence/i)).toBeVisible();
});

test('states the mission in full', async ({ page }) => {
  await page.goto('/collectors/about', { waitUntil: 'domcontentloaded' });

  const mission = page.getByRole('region', { name: 'Our Mission' });
  await expect(mission.getByRole('paragraph')).toHaveCount(3);
  await expect(mission.getByText(/5% by 2035/)).toBeVisible();
  await expect(
    mission.getByText(/not a question of quality, but of infrastructure/i),
  ).toBeVisible();
});

test('tells the story, including what the name means', async ({ page }) => {
  await page.goto('/collectors/about', { waitUntil: 'domcontentloaded' });

  const story = page.getByRole('region', { name: /the story/i });
  await expect(story.getByText(/from isiZulu, means to flourish and to blossom/i)).toBeVisible();
  await expect(story.getByText(/rather than another open marketplace/i)).toBeVisible();
});

test('names the three teams', async ({ page }) => {
  await page.goto('/collectors/about', { waitUntil: 'domcontentloaded' });

  const structure = page.getByRole('region', { name: 'How We Are Organised' });
  await expect(structure.getByRole('listitem')).toHaveCount(3);
  await expect(structure.getByRole('heading', { level: 3 })).toHaveText([
    'Intelligence',
    'Experience',
    'Advisory',
  ]);
});

test('closes into the intake', async ({ page }) => {
  await page.goto('/collectors/about', { waitUntil: 'domcontentloaded' });

  const closing = page.getByRole('region', { name: 'Begin Your Collector Journey' });
  await expect(closing.getByRole('link', { name: /begin collector intake/i })).toHaveAttribute(
    'href',
    '/collectors/apply',
  );
});

test('marks About as the current page in the navigation', async ({ page }) => {
  await page.goto('/collectors/about', { waitUntil: 'domcontentloaded' });
  await openNavIfCollapsed(page);

  await expect(
    page.getByRole('banner').getByRole('link', { name: 'About' }).first(),
  ).toHaveAttribute('aria-current', 'page');
});

test('does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collectors/about', { waitUntil: 'domcontentloaded' });

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
