import { describe, expect, it } from 'vitest';

import { artistProfileSchema } from './user';

describe('artistProfileSchema', () => {
  const valid = {
    displayName: 'Thandi M',
    statement: 'I paint the light of the highveld.',
    socials: { instagram: 'https://instagram.com/thandi' },
  };

  it('accepts a valid profile', () => {
    expect(artistProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a display name', () => {
    expect(artistProfileSchema.safeParse({ ...valid, displayName: '' }).success).toBe(false);
  });

  it('rejects a social link that is not a URL', () => {
    const result = artistProfileSchema.safeParse({ ...valid, socials: { instagram: 'thandi' } });
    expect(result.success).toBe(false);
  });

  it('allows omitting the optional statement and socials', () => {
    expect(artistProfileSchema.safeParse({ displayName: 'Thandi M' }).success).toBe(true);
  });
});
