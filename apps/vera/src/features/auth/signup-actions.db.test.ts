import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@qhakaza/shared-db';

const { signUp } = await import('./signup-actions');

const VALID = {
  name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  password: 'password123',
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

  it.each(['ADMIN', 'ADVISOR', 'COLLECTOR'])('ignores a %s role in the payload', async (role) => {
    /*
     * Vera makes artists and nothing else. The role is no longer part of what
     * the form sends, so a crafted request naming one is simply ignored rather
     * than obeyed. If this ever fails, the public artist site has become a way
     * to enrol yourself as staff.
     */
    const result = await signUp({ ...VALID, role });

    expect(result.ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: VALID.email } })).role).toBe(
      'ARTIST',
    );
  });

  it('always creates an artist, with no role asked for', async () => {
    await signUp(VALID);

    expect((await prisma.user.findUniqueOrThrow({ where: { email: VALID.email } })).role).toBe(
      'ARTIST',
    );
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
