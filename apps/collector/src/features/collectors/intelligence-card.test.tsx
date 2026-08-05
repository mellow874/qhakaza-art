import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { preview } from '@/content/collectors';

import { IntelligenceCard } from './intelligence-card';

const artist = preview.artistRecord;
const artwork = preview.artworkRecord;

describe('IntelligenceCard — artist record', () => {
  it('shows the record kind and its standing', () => {
    render(<IntelligenceCard record={artist} />);

    expect(screen.getByText('Artist Intelligence Record')).toBeInTheDocument();
    expect(screen.getByText('Emerging')).toBeInTheDocument();
  });

  it('shows the subject and its detail line', () => {
    render(<IntelligenceCard record={artist} />);

    expect(screen.getByRole('heading', { name: 'Naledi Mokoena' })).toBeInTheDocument();
    expect(screen.getByText('Johannesburg, South Africa')).toBeInTheDocument();
  });

  it('pairs every label with its value', () => {
    const { container } = render(<IntelligenceCard record={artist} />);

    const terms = [...container.querySelectorAll('dt')].map((node) => node.textContent);
    const values = [...container.querySelectorAll('dd')].map((node) => node.textContent);

    expect(terms).toEqual(artist.rows.map((row) => row.label));
    expect(values).toEqual(artist.rows.map((row) => row.value));
  });

  it('uses a description list, since these are attributes of one subject', () => {
    const { container } = render(<IntelligenceCard record={artist} />);

    expect(container.querySelector('dl')).toBeInTheDocument();
  });

  it('lists the supporting signals', () => {
    render(<IntelligenceCard record={artist} />);

    for (const tag of artist.tags) {
      expect(screen.getByText(tag)).toBeInTheDocument();
    }
  });

  it('shows the intelligence note', () => {
    render(<IntelligenceCard record={artist} />);

    expect(screen.getByText(artist.note.body)).toBeInTheDocument();
  });
});

describe('IntelligenceCard — artwork record', () => {
  it('shows the work with its artist and year', () => {
    render(<IntelligenceCard record={artwork} />);

    expect(screen.getByRole('heading', { name: 'Quiet Inheritance' })).toBeInTheDocument();
    expect(screen.getByText('Naledi Mokoena, 2025')).toBeInTheDocument();
  });

  it('keeps the standing badge distinct from a row that repeats its wording', () => {
    // This artwork is "Available" twice over: as its standing, and as the value
    // of the certificate row. The two must not be confusable.
    const { container } = render(<IntelligenceCard record={artwork} />);

    const header = container.querySelector('header')!;
    expect(within(header).getByText('Available')).toBeInTheDocument();
    expect(within(header).getByText('Artwork Intelligence Record')).toBeInTheDocument();

    const list = container.querySelector('dl')!;
    expect(within(list).getByText('Available')).toBeInTheDocument();
  });

  it('carries the pricing context, risk note and suggested step', () => {
    render(<IntelligenceCard record={artwork} />);

    expect(screen.getByText('Within established range for artist')).toBeInTheDocument();
    expect(screen.getByText('Emerging artist — early exposure')).toBeInTheDocument();
    expect(screen.getByText('Request private viewing')).toBeInTheDocument();
  });

  it('omits the tag list and note when the record has none', () => {
    const { container } = render(<IntelligenceCard record={artwork} />);

    expect(container.querySelector('ul')).not.toBeInTheDocument();
    expect(screen.queryByText(/intelligence note/i)).not.toBeInTheDocument();
  });
});
