import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ArtCard } from './art-card';

const work = {
  id: 'piece-1',
  title: 'Ubuntu in Ochre',
  images: ['https://cdn.example.com/ubuntu.jpg'],
  medium: 'Oil on canvas',
  price: '18500',
  currency: 'ZAR' as const,
  artist: { displayName: 'Thandi Mokoena', slug: 'thandi-mokoena' },
};

describe('ArtCard', () => {
  it('shows the title, artist, medium and price', () => {
    render(<ArtCard work={work} />);

    expect(screen.getByText('Ubuntu in Ochre')).toBeInTheDocument();
    expect(screen.getByText('Thandi Mokoena')).toBeInTheDocument();
    expect(screen.getByText('Oil on canvas')).toBeInTheDocument();
    expect(screen.getByText('R18 500')).toBeInTheDocument();
  });

  it('links to the piece', () => {
    render(<ArtCard work={work} />);

    expect(screen.getByRole('link', { name: /ubuntu in ochre/i })).toHaveAttribute(
      'href',
      '/art/piece-1',
    );
  });

  it('links to the artist storefront', () => {
    render(<ArtCard work={work} />);

    expect(screen.getByRole('link', { name: 'Thandi Mokoena' })).toHaveAttribute(
      'href',
      '/artists/thandi-mokoena',
    );
  });

  it('announces the piece once, not twice', () => {
    // The image and the title both link to the piece for mouse users, but a
    // screen reader should hear a single link.
    render(<ArtCard work={work} />);

    const pieceLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/art/piece-1');

    expect(pieceLinks).toHaveLength(1);
  });

  it('treats the cover image as decorative, since the title names the work', () => {
    render(<ArtCard work={work} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a placeholder rather than breaking the grid when there is no image', () => {
    render(<ArtCard work={{ ...work, images: [] }} />);

    expect(screen.getByText('Ubuntu in Ochre')).toBeInTheDocument();
    expect(screen.getByText(/image coming soon/i)).toBeInTheDocument();
  });

  it('formats a price that carries cents', () => {
    render(<ArtCard work={{ ...work, price: '1250.50' }} />);

    expect(screen.getByText('R1 250.50')).toBeInTheDocument();
  });
});
