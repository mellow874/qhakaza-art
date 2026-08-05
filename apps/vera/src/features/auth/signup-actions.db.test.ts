import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@qhakaza/shared-db';

const { signUp } = await import('./signup-actions');

const VALID = {
  name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  password: 'password123',
  role: 'ARTIST' as const,
};

beforeEach(async () => {
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();
});

describe('signUp', () => {
  it('creates an account and never stores the password', async () => {
    const result = await signUp(VALID);

    expect(result.ok).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: VALID.email } });
    expect(user.role).toBe('ARTIST');
    expect(user.passwordHash).not.toBe(VALID.password);
    expect(await bcrypt.compare(VALID.password, user.passwordHash!)).toBe(true);
  });

  it('normalises the email so one person is one account', async () => {
    await signUp({ ...VALID, email: '  Thandi@Example.COM ' });

    expect(await prisma.user.findUnique({ where: { email: 'thandi@example.com' } })).not.toBeNull();
  });

  it('lets a collector enrol, since a member needs an account before an invitation', async () => {
    const result = await signUp({ ...VALID, role: 'COLLECTOR' });

    expect(result.ok).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: VALID.email } });
    expect(user.role).toBe('COLLECTOR');
  });

  it.each(['ADMIN', 'ADVISOR'])('refuses to self-assign %s', async (role) => {
    // Staff are provisioned in the Command Center. If this ever passes, anyone
    // could enrol themselves as an administrator from the public site.
    const result = await signUp({ ...VALID, role });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuses a duplicate email without revealing anything else', async () => {
    await signUp(VALID);

    const result = await signUp({ ...VALID, name: 'Someone Else' });

    expect(result).toMatchObject({ ok: false, error: 'TAKEN' });
    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    ['a short password', { password: 'short' }],
    ['a malformed email', { email: 'thandi@' }],
    ['no name', { name: '   ' }],
  ])('rejects %s and writes nothing', async (_label, override) => {
    const result = await signUp({ ...VALID, ...override });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.user.count()).toBe(0);
  });
});
