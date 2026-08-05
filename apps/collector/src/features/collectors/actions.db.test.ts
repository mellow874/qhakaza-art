import { beforeEach, describe, expect, it } from 'vitest';

import { apply } from '@/content/collectors';
import { prisma } from '@qhakaza/shared-db';
import { resetDb } from '@tests/helpers/db';

const { submitCollectorApplication } = await import('./actions');

/** Only these two are required — everything else the design leaves unmarked. */
const MINIMAL = { fullName: 'Thandi Mokoena', email: 'thandi@example.com' };

const FULL = {
  ...MINIMAL,
  phone: '+27 82 000 0000',
  country: 'South Africa',
  city: 'Johannesburg',
  annualIncomeBand: apply.financial.incomeBands[2].value,
  liquidAssetsBand: apply.financial.assetBands[3].value,
  collectingGoal: 'To build a considered collection of contemporary work from the continent.',
  artExposure: 'Two acquisitions through a gallery, no advisor.',
  preferredMediums: ['Painting', 'Photography'],
};

beforeEach(async () => {
  await resetDb();
});

describe('submitCollectorApplication', () => {
  it('records a complete application', async () => {
    const result = await submitCollectorApplication(FULL);

    expect(result.ok).toBe(true);

    const stored = await prisma.collectorIntake.findFirstOrThrow();
    expect(stored.fullName).toBe(FULL.fullName);
    expect(stored.city).toBe('Johannesburg');
    expect(stored.annualIncomeBand).toBe(FULL.annualIncomeBand);
    expect(stored.preferredMediums).toEqual(['Painting', 'Photography']);
  });

  it('accepts an application with nothing but a name and an email', async () => {
    // The financial questions are intrusive and optional. Declining to answer
    // them must not cost someone their application.
    const result = await submitCollectorApplication(MINIMAL);

    expect(result.ok).toBe(true);

    const stored = await prisma.collectorIntake.findFirstOrThrow();
    expect(stored.annualIncomeBand).toBeNull();
    expect(stored.liquidAssetsBand).toBeNull();
    expect(stored.preferredMediums).toEqual([]);
  });

  it('rests at awaiting verification, since that step is not built', async () => {
    await submitCollectorApplication(MINIMAL);

    const stored = await prisma.collectorIntake.findFirstOrThrow();
    expect(stored.status).toBe('AWAITING_VERIFICATION');
  });

  it('normalises the email so one person is one applicant', async () => {
    await submitCollectorApplication({ ...MINIMAL, email: '  Thandi@Example.COM ' });

    const stored = await prisma.collectorIntake.findFirstOrThrow();
    expect(stored.email).toBe('thandi@example.com');
  });

  it.each([
    ['no name', { ...MINIMAL, fullName: '   ' }, 'fullName'],
    ['a malformed email', { ...MINIMAL, email: 'thandi@' }, 'email'],
  ])('rejects an application with %s and writes nothing', async (_label, input, field) => {
    const result = await submitCollectorApplication(input);

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(result.ok === false && result.fieldErrors?.[field]).toBeTruthy();
    expect(await prisma.collectorIntake.count()).toBe(0);
  });

  it('refuses a medium that is not on the published list', async () => {
    // The chips are client state; a crafted request can send anything.
    const result = await submitCollectorApplication({
      ...MINIMAL,
      preferredMediums: ['Painting', 'Fine Wine'],
    });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.collectorIntake.count()).toBe(0);
  });

  it('refuses a financial band that is not on the published list', async () => {
    const result = await submitCollectorApplication({ ...MINIMAL, annualIncomeBand: 'OVER_9000' });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.collectorIntake.count()).toBe(0);
  });

  it('stores one medium once, however many times it is sent', async () => {
    await submitCollectorApplication({
      ...MINIMAL,
      preferredMediums: ['Painting', 'Painting', 'Print'],
    });

    const stored = await prisma.collectorIntake.findFirstOrThrow();
    expect(stored.preferredMediums).toEqual(['Painting', 'Print']);
  });

  it('records more than one application', async () => {
    await submitCollectorApplication(MINIMAL);
    await submitCollectorApplication({ fullName: 'Sipho Dube', email: 'sipho@example.com' });

    expect(await prisma.collectorIntake.count()).toBe(2);
  });
});
