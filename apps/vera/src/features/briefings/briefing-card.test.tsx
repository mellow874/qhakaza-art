import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BriefingCard } from './briefing-card';

/**
 * A briefing as the DATABASE now supplies it.
 *
 * These used to be read from `content/briefings.ts`. Briefings moved into the
 * database in Phase 7, and with them the date changed from a pre-formatted
 * string to a real Date the card formats itself. The fixture is written out
 * here rather than imported so the test states the shape it depends on.
 */
const briefing = {
  slug: 'when-art-becomes-an-asset',
  category: 'Market Intelligence',
  title: 'When Art Becomes an Asset',
  excerpt: 'Art has always lived between two worlds.',
  coverImageUrl: null,
  publishedAt: new Date('2026-05-07T00:00:00.000Z'),
};

describe('BriefingCard', () => {
  it('shows the category, title, excerpt and date', () => {
    render(<BriefingCard briefing={briefing} />);

    expect(screen.getByText(briefing.category)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: briefing.title })).toBeInTheDocument();
    expect(screen.getByText(briefing.excerpt)).toBeInTheDocument();
    expect(screen.getByText('7 May 2026')).toBeInTheDocument();
  });

  it('links to the article', () => {
    render(<BriefingCard briefing={briefing} />);

    expect(screen.getByRole('link', { name: briefing.title })).toHaveAttribute(
      'href',
      `/briefings/${briefing.slug}`,
    );
  });

  it('announces the article once, not twice', () => {
    // The image links to the same article for mouse users, but a screen reader
    // should hear a single link.
    render(<BriefingCard briefing={briefing} />);

    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === `/briefings/${briefing.slug}`);

    expect(links).toHaveLength(1);
  });

  it('marks the date up as a machine-readable time', () => {
    const { container } = render(<BriefingCard briefing={briefing} />);

    // A full ISO timestamp now, because the value is a real Date rather than a
    // pre-formatted string.
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      briefing.publishedAt.toISOString(),
    );
  });
});
