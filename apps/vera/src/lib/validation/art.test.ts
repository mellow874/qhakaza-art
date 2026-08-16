import { describe, expect, it } from 'vitest';

import { artPieceDraftSchema, artPieceListedSchema, artPieceSchemaForStatus } from './art';

const completePiece = {
  title: 'Ubuntu in Ochre',
  description: 'Layered ochre pigment on stretched canvas, part of the Ubuntu series.',
  images: ['https://cdn.example.com/ubuntu-1.jpg'],
  medium: 'Oil on canvas',
  dimensions: '900 x 1200 mm',
  price: 12500,
  currency: 'ZAR',
};

describe('artPieceDraftSchema', () => {
  it('accepts a bare draft with only a title', () => {
    const result = artPieceDraftSchema.safeParse({ title: 'Untitled study' });
    expect(result.success).toBe(true);
  });

  it('still rejects an empty title', () => {
    const result = artPieceDraftSchema.safeParse({ title: '   ' });
    expect(result.success).toBe(false);
  });

  it('trims the title', () => {
    const result = artPieceDraftSchema.parse({ title: '  Untitled study  ' });
    expect(result.title).toBe('Untitled study');
  });
});

describe('artPieceListedSchema', () => {
  it('accepts a complete piece', () => {
    const result = artPieceListedSchema.safeParse(completePiece);
    expect(result.success).toBe(true);
  });

  it.each([
    ['description', 'description'],
    ['images', 'images'],
    ['medium', 'medium'],
    ['dimensions', 'dimensions'],
    ['price', 'price'],
  ])('rejects a listing missing %s', (_label, field) => {
    const piece: Record<string, unknown> = { ...completePiece };
    delete piece[field];

    const result = artPieceListedSchema.safeParse(piece);

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it('rejects a listing with no images', () => {
    const result = artPieceListedSchema.safeParse({ ...completePiece, images: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive price', () => {
    expect(artPieceListedSchema.safeParse({ ...completePiece, price: 0 }).success).toBe(false);
    expect(artPieceListedSchema.safeParse({ ...completePiece, price: -1 }).success).toBe(false);
  });

  it('rejects a price with more than two decimal places', () => {
    const result = artPieceListedSchema.safeParse({ ...completePiece, price: 199.999 });
    expect(result.success).toBe(false);
  });

  it('coerces a numeric price submitted as a form string', () => {
    const result = artPieceListedSchema.parse({ ...completePiece, price: '12500' });
    expect(result.price).toBe(12500);
  });

  it('rejects an unsupported currency', () => {
    const result = artPieceListedSchema.safeParse({ ...completePiece, currency: 'XYZ' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-https image URL', () => {
    const result = artPieceListedSchema.safeParse({
      ...completePiece,
      images: ['javascript:alert(1)'],
    });
    expect(result.success).toBe(false);
  });
});

describe('artPieceSchemaForStatus', () => {
  it('uses the lenient schema for DRAFT and HIDDEN', () => {
    expect(artPieceSchemaForStatus('DRAFT').safeParse({ title: 'WIP' }).success).toBe(true);
    expect(artPieceSchemaForStatus('HIDDEN').safeParse({ title: 'WIP' }).success).toBe(true);
  });

  it('uses the strict schema for PUBLISHED and SOLD', () => {
    expect(artPieceSchemaForStatus('PUBLISHED').safeParse({ title: 'WIP' }).success).toBe(false);
    expect(artPieceSchemaForStatus('SOLD').safeParse({ title: 'WIP' }).success).toBe(false);
    expect(artPieceSchemaForStatus('PUBLISHED').safeParse(completePiece).success).toBe(true);
  });
});
