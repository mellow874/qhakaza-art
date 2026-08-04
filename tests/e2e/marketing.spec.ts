import { expect, openNavIfCollapsed, test } from './fixtures';

/**
 * The public marketing pages.
 *
 * Almost all of these are static and read-only. The exception is the contact
 * form, which inserts a `ContactMessage` row — it uses a unique email per run
 * and reads nothing back, so it stays parallel-safe.
 */

test.describe('home', () => {
  test('an anonymous visitor gets the whole page', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: /structured for serious attention/i }),
    ).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('every section is present, in order', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    for (const name of [
      /a serious structure for a serious practice/i,
      /the sx score/i,
      /built for the rooms where details matter/i,
      /intelligence briefings/i,
      /begin structuring your practice/i,
    ]) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
  });

  test('the framework quote is rendered as a quotation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const quote = page.locator('blockquote');
    await expect(quote).toContainText(/the problem is not the absence of quality/i);
    await expect(quote).toContainText(/it is the absence of structure/i);
  });

  test('the Sx Score exposes its values to assistive tech', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const cam = page.getByRole('meter', { name: /CAM/ });
    await expect(cam).toHaveAttribute('aria-valuenow', '72');
    await expect(page.getByText('54')).toBeVisible();
  });

  test('is server-rendered for search engines', async ({ request }) => {
    const html = await (await request.get('/')).text();

    expect(html).toContain('Qhakaza Art Collective');
    expect(html).toContain('structured for serious attention');
    expect(html).toContain('og:title');
  });

  test('the briefings link through to their articles', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: /all briefings/i })).toHaveAttribute(
      'href',
      '/briefings',
    );
    await expect(page.getByRole('link', { name: /when art becomes an asset/i })).toHaveAttribute(
      'href',
      '/briefings/when-art-becomes-an-asset',
    );
  });

  test('the closing call to action reaches the suite and the about page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const begin = page.getByRole('region', { name: /begin structuring your practice/i });
    await expect(begin.getByRole('link', { name: /enter the suite/i })).toHaveAttribute(
      'href',
      '/login',
    );
    await expect(begin.getByRole('link', { name: /about the collective/i })).toHaveAttribute(
      'href',
      '/about',
    );
  });
});

test.describe('about', () => {
  test('renders for an anonymous visitor', async ({ page }) => {
    const response = await page.goto('/about', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', {
        name: /institutional discipline for early-stage cultural assets/i,
      }),
    ).toBeVisible();
  });

  test('carries the position statement and its pull quote', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/underpriced value that is often overlooked/i)).toBeVisible();
    await expect(page.locator('blockquote')).toContainText(
      /qhakaza art collective exists to change that/i,
    );
    await expect(page.getByText(/not a gallery, not a marketplace/i)).toBeVisible();
  });

  test('has exactly one h1', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('closes with a call to action', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: /get started/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  test('is reachable from the main navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openNavIfCollapsed(page);

    await page.getByRole('banner').getByRole('link', { name: 'About' }).click();

    await expect(page).toHaveURL(/\/about/);
  });

  test('is marked as the current page once there', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    await openNavIfCollapsed(page);

    await expect(
      page.getByRole('banner').getByRole('link', { name: 'About' }).first(),
    ).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('how it works', () => {
  test('renders for an anonymous visitor', async ({ page }) => {
    const response = await page.goto('/how-it-works', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: /how qhakaza art collective works/i }),
    ).toBeVisible();
  });

  test('lists all seven steps in order', async ({ page }) => {
    await page.goto('/how-it-works', { waitUntil: 'domcontentloaded' });

    const steps = page.getByRole('listitem').filter({ has: page.getByRole('heading') });
    await expect(steps).toHaveCount(7);

    await expect(steps.first()).toContainText('Sign Up');
    await expect(steps.last()).toContainText('Track Progress');
  });

  test('marks up the process as an ordered list', async ({ page }) => {
    // The sequence is the meaning here, so it must be conveyed structurally.
    await page.goto('/how-it-works', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('main ol')).toHaveCount(1);
  });

  test('carries the detail of each step', async ({ page }) => {
    await page.goto('/how-it-works', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/structured identity intake/i)).toBeVisible();
    await expect(
      page.getByText(/provenance records, certificates, condition reports/i),
    ).toBeVisible();
  });

  test('closes with a call to action', async ({ page }) => {
    await page.goto('/how-it-works', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: /get started/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  test('is reachable from the navigation and marked current', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openNavIfCollapsed(page);

    await page.getByRole('banner').getByRole('link', { name: 'How it works' }).click();

    await expect(page).toHaveURL(/\/how-it-works/);
    await openNavIfCollapsed(page);
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'How it works' }).first(),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('does not scroll sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/how-it-works', { waitUntil: 'domcontentloaded' });

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});

test.describe('features', () => {
  test('renders for an anonymous visitor', async ({ page }) => {
    const response = await page.goto('/features', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: /what you get with qhakaza art collective/i }),
    ).toBeVisible();
  });

  test('lists all six features', async ({ page }) => {
    await page.goto('/features', { waitUntil: 'domcontentloaded' });

    const items = page.getByRole('listitem').filter({ has: page.getByRole('heading') });
    await expect(items).toHaveCount(6);
  });

  test('names each feature', async ({ page }) => {
    await page.goto('/features', { waitUntil: 'domcontentloaded' });

    for (const name of [
      'Artist Profile Setup',
      'Artwork Records',
      'Documentation Suite',
      'Evidence Completeness Tracking',
      'Personal Dashboard',
      'News & Insights Access',
    ]) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
  });

  test('carries the detail behind each feature', async ({ page }) => {
    await page.goto('/features', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/KYC fields, professional credentials/i)).toBeVisible();
    await expect(page.getByText(/completeness indicator/i)).toBeVisible();
  });

  test('closes with a call to action', async ({ page }) => {
    await page.goto('/features', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: /structure your practice today/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  test('is reachable from the navigation and marked current', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openNavIfCollapsed(page);

    await page.getByRole('banner').getByRole('link', { name: 'Features' }).click();

    await expect(page).toHaveURL(/\/features/);
    await openNavIfCollapsed(page);
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Features' }).first(),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('does not scroll sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/features', { waitUntil: 'domcontentloaded' });

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});

test.describe('briefings', () => {
  test('renders for an anonymous visitor', async ({ page }) => {
    const response = await page.goto('/briefings', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'News & Insights' })).toBeVisible();
  });

  test('lists the published briefings with their categories and dates', async ({ page }) => {
    await page.goto('/briefings', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /when art becomes an asset/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /the visibility gap/i })).toBeVisible();
    await expect(page.getByText('Market Intelligence')).toBeVisible();
    await expect(page.getByText('7 May 2026')).toBeVisible();
  });

  test('each briefing links to its article', async ({ page }) => {
    await page.goto('/briefings', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: /when art becomes an asset/i })).toHaveAttribute(
      'href',
      '/briefings/when-art-becomes-an-asset',
    );
  });

  test('is reachable from the navigation and marked current', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openNavIfCollapsed(page);

    await page.getByRole('banner').getByRole('link', { name: 'Briefings' }).click();

    await expect(page).toHaveURL(/\/briefings/);
    await openNavIfCollapsed(page);
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Briefings' }).first(),
    ).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('faq', () => {
  test('renders for an anonymous visitor', async ({ page }) => {
    const response = await page.goto('/faq', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: /frequently asked questions/i }),
    ).toBeVisible();
  });

  test('offers both a contact route and a sign-up route', async ({ page }) => {
    await page.goto('/faq', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /still have questions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /contact us/i })).toHaveAttribute(
      'href',
      '/contact',
    );
    await expect(page.getByRole('link', { name: /get started/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});

test.describe('contact', () => {
  test('renders for an anonymous visitor', async ({ page }) => {
    const response = await page.goto('/contact', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: /get in touch/i })).toBeVisible();
  });

  test('shows the enquiries address as a mailto link', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: 'info@qhakazaartcollective.com' })).toHaveAttribute(
      'href',
      'mailto:info@qhakazaartcollective.com',
    );
  });

  test('offers the full enquiry form', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded' });

    for (const label of ['Name', 'Email', 'Subject', 'Message']) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /send message/i })).toBeVisible();
  });

  test('refuses an incomplete enquiry', async ({ page }) => {
    await page.goto('/contact');

    await page.getByRole('button', { name: /send message/i }).click();

    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  test('accepts and confirms a complete enquiry', async ({ page }) => {
    await page.goto('/contact');

    await page.getByLabel('Name', { exact: true }).fill('E2E Visitor');
    await page.getByLabel('Email', { exact: true }).fill(`e2e-${Date.now()}@test.local`);
    await page.getByLabel('Subject', { exact: true }).fill('Automated enquiry');
    await page
      .getByLabel('Message', { exact: true })
      .fill('This enquiry was submitted by the end-to-end test suite.');
    await page.getByRole('button', { name: /send message/i }).click();

    await expect(page.getByRole('status')).toContainText(/message has been received/i);
  });

  test('is reachable from the footer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.getByRole('contentinfo').getByRole('link', { name: 'Contact' }).click();

    await expect(page).toHaveURL(/\/contact/);
  });
});

test.describe('site chrome', () => {
  test('the footer groups its links under headed columns', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const footer = page.getByRole('contentinfo');
    for (const column of ['Platform', 'Company', 'Legal']) {
      await expect(footer.getByRole('navigation', { name: column })).toBeVisible();
    }
    await expect(footer.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  });

  test('the header offers the suite to an anonymous visitor', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openNavIfCollapsed(page);

    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    await expect(header.getByRole('link', { name: 'Enter the suite' }).first()).toBeVisible();
  });

  test('the page does not scroll sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
});
