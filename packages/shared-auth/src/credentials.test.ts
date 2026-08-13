import { describe, expect, it } from 'vitest';

import { credentialsSchema, newAccountSchema } from './credentials';

describe('newAccountSchema', () => {
  const valid = {
    name: 'Thandi Mokoena',
    email: 'thandi@example.com',
    password: 'correct-horse-9',
  };

  it('accepts a valid account', () => {
    expect(newAccountSchema.safeParse(valid).success).toBe(true);
  });

  it('lowercases and trims the email, so one person is one account', () => {
    expect(newAccountSchema.parse({ ...valid, email: '  Thandi@Example.COM ' }).email).toBe(
      'thandi@example.com',
    );
  });

  it.each([
    ['a malformed email', { email: 'not-an-email' }],
    ['a short password', { password: 'short7!' }],
    ['no name', { name: '   ' }],
  ])('rejects %s', (_label, override) => {
    expect(newAccountSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('carries no role at all, so none can be chosen by the browser', () => {
    /*
     * This replaced a schema with a `role` field the client sent. Each site now
     * fixes the role server-side — Vera makes artists, the Collector Platform
     * makes collectors — so a crafted payload has nothing to aim at.
     */
    const parsed = newAccountSchema.parse({ ...valid, role: 'ADMIN' });

    expect(parsed).not.toHaveProperty('role');
    expect(Object.keys(parsed).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('credentialsSchema', () => {
  it('accepts an email and password pair', () => {
    expect(
      credentialsSchema.safeParse({ email: 'a@b.com', password: 'password1' }).success,
    ).toBe(true);
  });

  it('rejects a missing password', () => {
    expect(credentialsSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });

  it('does not impose password rules on sign-in', () => {
    // Strength rules here would leak them to anyone probing the login form, and
    // would lock out accounts created under older rules.
    expect(credentialsSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});
