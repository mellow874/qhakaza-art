import { describe, expect, it } from 'vitest';

import { credentialsSchema } from './credentials';

describe('credentialsSchema', () => {
  it('accepts an email and password pair', () => {
    expect(credentialsSchema.safeParse({ email: 'a@b.com', password: 'password1' }).success).toBe(
      true,
    );
  });

  it('rejects a missing password', () => {
    expect(credentialsSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });

  it('normalises the email, so one account is one identity', () => {
    const result = credentialsSchema.parse({ email: '  A@B.COM ', password: 'x' });
    expect(result.email).toBe('a@b.com');
  });

  it('does not impose password strength rules on a sign-in attempt', () => {
    // Strength belongs at sign-up. Enforcing it here would leak the rules to
    // anyone probing the form, and lock out accounts made under older ones.
    expect(credentialsSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});
