import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeaturedWorks } from './featured-works';

const works = [
  {
    id: 'piece-1',
    title: 'Ubuntu in Ochre',
    images: ['https://cdn.example.com/1.jpg'],
    medium: 'Oil on canvas',
    price: '18500',
    currency: 'ZAR' as const,
    artist: { displayName: 'Thandi Mokoena', slug: 'thandi-mokoena' },
  },
  {
    id: 'piece-2',
    title: 'Shift Change',
    images: ['https://cdn.example.com/2.jpg'],
    medium: 'Linocut',
    price: '4500',
    currency: 'ZAR' as const,
    artist: { displayName: 'Sipho Ndlovu', slug: 'sipho-ndlovu' },
  },
];

describe('FeaturedWorks', () => {
  it('renders a card per piece', () => {
    render(<FeaturedWorks works={works} />);

    expect(screen.getByText('Ubuntu in Ochre')).toBeInTheDocument();
    expect(screen.getByText('Shift Change')).toBeInTheDocument();
  });

  it('offers a way through to the full gallery', () => {
    render(<FeaturedWorks works={works} />);

    expect(screen.getByRole('link', { name: /view all|browse/i })).toHaveAttribute(
      'href',
      '/browse',
    );
  });

  it('says so plainly when there is nothing to show', () => {
    render(<FeaturedWorks works={[]} />);

    expect(screen.getByText(/no work available/i)).toBeInTheDocument();
  });

  it('does not offer a dead-end gallery link when empty', () => {
    render(<FeaturedWorks works={[]} />);

    expect(screen.queryByRole('link', { name: /view all/i })).not.toBeInTheDocument();
  });

  it('is announced as a titled section', () => {
    render(<FeaturedWorks works={works} />);

    expect(screen.getByRole('region', { name: /available now/i })).toBeInTheDocument();
  });
});
