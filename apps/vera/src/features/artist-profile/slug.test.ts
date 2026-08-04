import { describe, expect, it } from 'vitest';

import { slugify, uniqueSlug } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Thandi Mokoena')).toBe('thandi-mokoena');
  });

  it('strips punctuation', () => {
    expect(slugify("Sipho's Studio & Press!")).toBe('siphos-studio-press');
  });

  it('folds accented characters to ascii', () => {
    expect(slugify('Zoë Müller')).toBe('zoe-muller');
  });

  it('collapses runs of separators and trims them from the ends', () => {
    expect(slugify('  --Studio   Ndlovu--  ')).toBe('studio-ndlovu');
  });

  it('keeps digits', () => {
    expect(slugify('Studio 54')).toBe('studio-54');
  });

  it('caps length so a slug cannot be unbounded', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });

  it('falls back to "artist" when nothing usable survives', () => {
    expect(slugify('!!!')).toBe('artist');
    expect(slugify('')).toBe('artist');
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when it is free', async () => {
    const result = await uniqueSlug('Thandi Mokoena', async () => false);
    expect(result).toBe('thandi-mokoena');
  });

  it('appends a counter until it finds a free slug', async () => {
    const taken = new Set(['thandi-mokoena', 'thandi-mokoena-2']);
    const result = await uniqueSlug('Thandi Mokoena', async (slug) => taken.has(slug));
    expect(result).toBe('thandi-mokoena-3');
  });

  it('asks about the base slug first', async () => {
    const asked: string[] = [];
    await uniqueSlug('Studio 54', async (slug) => {
      asked.push(slug);
      return asked.length < 2;
    });
    expect(asked[0]).toBe('studio-54');
    expect(asked[1]).toBe('studio-54-2');
  });
});
