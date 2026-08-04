import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@qhakaza/shared-db';
import { resetDb } from '@tests/helpers/db';

const { submitContactMessage } = await import('./actions');

const VALID = {
  name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  subject: 'Subscription question',
  message: 'I would like to know more about registering my artworks on the platform.',
};

beforeEach(async () => {
  await resetDb();
});

describe('submitContactMessage', () => {
  it('records the enquiry', async () => {
    const result = await submitContactMessage(VALID);

    expect(result.ok).toBe(true);

    const stored = await prisma.contactMessage.findFirstOrThrow();
    expect(stored.name).toBe(VALID.name);
    expect(stored.subject).toBe(VALID.subject);
    expect(stored.message).toBe(VALID.message);
  });

  it('normalises the email so replies are not lost to casing', async () => {
    await submitContactMessage({ ...VALID, email: '  THANDI@Example.COM ' });

    const stored = await prisma.contactMessage.findFirstOrThrow();
    expect(stored.email).toBe('thandi@example.com');
  });

  it('marks new enquiries as unhandled', async () => {
    await submitContactMessage(VALID);

    const stored = await prisma.contactMessage.findFirstOrThrow();
    expect(stored.handled).toBe(false);
  });

  it.each([
    ['name', { ...VALID, name: '   ' }],
    ['email', { ...VALID, email: 'not-an-email' }],
    ['subject', { ...VALID, subject: '' }],
    ['message', { ...VALID, message: 'hi' }],
  ])('rejects a bad %s and stores nothing', async (field, input) => {
    const result = await submitContactMessage(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('INVALID');
      expect(result.fieldErrors?.[field]).toBeTruthy();
    }
    expect(await prisma.contactMessage.count()).toBe(0);
  });

  it('ignores fields the form has no business setting', async () => {
    // `handled` is for whoever triages the inbox, not the sender.
    await submitContactMessage({ ...VALID, handled: true } as never);

    const stored = await prisma.contactMessage.findFirstOrThrow();
    expect(stored.handled).toBe(false);
  });

  it('accepts more than one enquiry', async () => {
    await submitContactMessage(VALID);
    await submitContactMessage({ ...VALID, subject: 'A second question' });

    expect(await prisma.contactMessage.count()).toBe(2);
  });
});
