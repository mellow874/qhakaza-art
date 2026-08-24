import { expect, openNavIfCollapsed, test } from './fixtures';

/**
 * The Collector Intelligence Suite — a separate light-themed sub-brand with its
 * own chrome. Static and read-only.
 */

test('renders for an anonymous visitor', async ({ page }) => {
  const response = await page.goto('/collectors', { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /the private route into african contemporary art/i,
    }),
  ).toBeVisible();
});

test('every section of the page is present', async ({ page }) => {
  await page.goto('/collectors', { waitUntil: 'domcontentloaded' });

  // Scoped to level 2: "News & Insights" is also one of the six benefit
  // headings, so an unlevelled match resolves to two elements.
  for (const name of [
    /what you receive/i,
    /attention is public/i,
    /what intelligence looks like/i,
    /private collector dinner/i,
    /news & insights/i,
    /enter african art with quiet confidence/i,
  ]) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
});

test('lists all six membership benefits', async ({ page }) => {
  await page.goto('/collectors', { waitUntil: 'domcontentloaded' });

  const benefits = page.getByRole('region', { name: /what you receive/i });
  await expect(benefits.getByRole('listitem')).toHaveCount(6);
  await expect(benefits.getByRole('heading', { name: 'Dashboard Access' })).toBeVisible();
});

test('shows both intelligence records with their evidence', async ({ page }) => {
  await page.goto('/collectors', { waitUntil: 'domcontentloaded' });

  const preview = page.getByRole('region', { name: /what intelligence looks like/i });

  await expect(preview.getByRole('heading', { name: 'Naledi Mokoena' })).toBeVisible();
  await expect(preview.getByText('$1,400 – $3,500')).toBeVisible();
  await expect(preview.getByText(/consistent visual language/i)).toBeVisible();

  await expect(preview.getByRole('heading', { name: 'Quiet Inheritance' })).toBeVisible();
  await expect(preview.getByText('Within established range for artist')).toBeVisible();
  await expect(preview.getByText('Request private viewing')).toBeVisible();
});

test('the collector navigation is its own, not the artist site’s', async ({ page }) => {
  await page.goto('/collectors', { waitUntil: 'domcontentloaded' });
  await openNavIfCollapsed(page);

  const header = page.getByRole('banner');
  for (const label of ['Suite', 'About', 'Membership', 'Pricing']) {
    await expect(header.getByRole('link', { name: label }).first()).toBeVisible();
  }
  await expect(header.getByRole('link', { name: 'Apply' }).first()).toHaveAttribute(
    'href',
    '/collectors/apply',
  );

  // The artist site's items must not leak in.
  await expect(header.getByRole('link', { name: 'How it works' })).toHaveCount(0);
  await expect(header.getByRole('link', { name: 'Briefings' })).toHaveCount(0);
});

test('the footer groups links under Suite, Discover and Access', async ({ page }) => {
  await page.goto('/collectors', { waitUntil: 'domcontentloaded' });

  const footer = page.getByRole('contentinfo');
  for (const column of ['Suite', 'Discover', 'Access']) {
    await expect(footer.getByRole('navigation', { name: column })).toBeVisible();
  }
});

test('the three journeys lead to three different places', async ({ page }) => {
  /*
   * These used to converge: every CTA on the site pointed at /collectors/apply,
   * so "Request access" silently started full onboarding. They are three
   * different asks and must stay three different destinations.
   */
  await page.goto('/collectors', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('link', { name: /begin collector intake/i }).first()).toHaveAttribute(
    'href',
    '/collectors/apply',
  );

  // Scoped to the experience section: the footer carries its own "Request Access".
  const experience = page.getByRole('region', { name: /private collector dinner/i });
  await expect(experience.getByRole('link', { name: /request access/i })).toHaveAttribute(
    'href',
    '/collectors/request',
  );

  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Request Access' })).toHaveAttribute(
    'href',
    '/collectors/request',
  );
  await expect(footer.getByRole('link', { name: 'Begin Intake' })).toHaveAttribute(
    'href',
    '/collectors/apply',
  );
});

test('the suite renders light', async ({ page }) => {
  /*
   * Proves the token flip actually reaches the DOM, rather than only applying
   * the class — a class-name assertion passes even when no token resolves.
   *
   * This used to measure the dark artist site in the same test, for contrast.
   * Phase 2 moved `/` into Vera, so the two grounds now live in two apps and no
   * single Playwright run can see both. The dark half is asserted in Vera's own
   * suite instead; neither assertion was dropped.
   */
  await page.goto('/collectors', { waitUntil: 'domcontentloaded' });

  const collectorSuite = await page.evaluate(() => {
    const el = document.querySelector('.theme-light');
    const rgb = getComputedStyle(el!).backgroundColor;
    const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  });

  expect(collectorSuite).toBeGreaterThan(200);
});

test('is server-rendered for search engines', async ({ request }) => {
  const html = await (await request.get('/collectors')).text();

  expect(html).toContain('Collector Intelligence Suite');
  expect(html).toContain('The Private Route Into African Contemporary Art');
  expect(html).toContain('og:title');
});

test('does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/collectors', { waitUntil: 'domcontentloaded' });

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
