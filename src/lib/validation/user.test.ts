import { describe, expect, it } from 'vitest';

import { artistProfileSchema, credentialsSchema, signUpSchema } from './user';

describe('signUpSchema', () => {
  const valid = {
    name: 'Thandi Mokoena',
    email: 'thandi@example.com',
    password: 'correct-horse-9',
    role: 'ARTIST',
  };

  it('accepts a valid artist sign-up', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it('lowercases and trims the email', () => {
    const result = signUpSchema.parse({ ...valid, email: '  Thandi@Example.COM ' });
    expect(result.email).toBe('thandi@example.com');
  });

  it('rejects a malformed email', () => {
    expect(signUpSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(signUpSchema.safeParse({ ...valid, password: 'short7!' }).success).toBe(false);
  });

  it('refuses to let anyone self-register as ADMIN', () => {
    const result = signUpSchema.safeParse({ ...valid, role: 'ADMIN' });
    expect(result.success).toBe(false);
  });

  it('defaults the role to COLLECTOR', () => {
    const { role: _role, ...withoutRole } = valid;
    expect(signUpSchema.parse(withoutRole).role).toBe('COLLECTOR');
  });
});

describe('credentialsSchema', () => {
  it('accepts an email and password pair', () => {
    expect(credentialsSchema.safeParse({ email: 'a@b.com', password: 'password1' }).success).toBe(
      true,
    );
  });

  it('rejects a missing password', () => {
    expect(credentialsSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });
});

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
