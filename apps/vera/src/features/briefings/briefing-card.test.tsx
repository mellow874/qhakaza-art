import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { briefings } from '@/content/briefings';

import { BriefingCard } from './briefing-card';

const briefing = briefings[0];

describe('BriefingCard', () => {
  it('shows the category, title, excerpt and date', () => {
    render(<BriefingCard briefing={briefing} />);

    expect(screen.getByText(briefing.category)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: briefing.title })).toBeInTheDocument();
    expect(screen.getByText(briefing.excerpt)).toBeInTheDocument();
    expect(screen.getByText(briefing.dateLabel)).toBeInTheDocument();
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

    expect(container.querySelector('time')).toHaveAttribute('datetime', briefing.date);
  });
});
