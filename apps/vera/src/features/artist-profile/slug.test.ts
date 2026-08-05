import { describe, expect, it } from 'vitest';

import { slugCandidates, slugify } from './slug';

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

describe('slugCandidates', () => {
  it('offers the plain slug first', () => {
    expect(slugCandidates('Thandi Mokoena')[0]).toBe('thandi-mokoena');
  });

  it('then counts upwards from two', () => {
    expect(slugCandidates('Studio 54').slice(0, 3)).toEqual([
      'studio-54',
      'studio-54-2',
      'studio-54-3',
    ]);
  });

  it('is bounded, so a pathological name cannot spin forever', () => {
    expect(slugCandidates('Thandi Mokoena', 5)).toHaveLength(5);
  });

  it('never repeats a candidate', () => {
    const candidates = slugCandidates('Thandi Mokoena');
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
