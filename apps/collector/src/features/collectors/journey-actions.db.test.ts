import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The public forms are rate limited, and the limiter reads the forwarded
 * address to tell callers apart. Server-side `headers()` has no request store
 * in a test, so it is stubbed with a fixed address - which also means every
 * case here shares one bucket, and the reset below keeps them from consuming
 * each other's allowance.
 */
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.5']]) as unknown as Headers,
}));

import { prisma } from '@qhakaza/shared-db';

const { requestMembershipConsideration } = await import('./journey-actions');

const ONBOARDED = 'onboarded@test.local';

const CONSIDERATION = {
  fullName: 'Thandi Mokoena',
  email: 'thandi@test.local',
  considerationNote: 'I would like to join but cannot meet the annual fee this year.',
};

beforeEach(async () => {
  // Cleared for the same reason as the intakes: every case here shares one
  // stubbed caller, so an uncleared counter would fail the later ones.
  await prisma.rateLimitCounter.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.collectorIntake.deleteMany();
});

describe('requestMembershipConsideration', () => {
  it('records the request, tagged as its own journey', async () => {
    const result = await requestMembershipConsideration(CONSIDERATION);

    expect(result.ok).toBe(true);
    const row = await prisma.collectorIntake.findFirstOrThrow();
    expect(row.kind).toBe('MEMBERSHIP_CONSIDERATION');
    expect(row.considerationNote).toContain('cannot meet the annual fee');
  });

  it('never records a financial band, because it never asks for one', async () => {
    // The whole point of this journey is that the fee is the obstacle. Asking
    // for income and liquid assets here would be the wrong thing to do, and a
    // crafted request must not be able to smuggle them in either.
    await requestMembershipConsideration({
      ...CONSIDERATION,
      annualIncomeBand: 'OVER_5M',
      liquidAssetsBand: 'OVER_25M',
    });

    const row = await prisma.collectorIntake.findFirstOrThrow();
    expect(row.annualIncomeBand).toBeNull();
    expect(row.liquidAssetsBand).toBeNull();
  });

  it('does not require onboarding first — that is the point', async () => {
    expect(await prisma.collectorIntake.count()).toBe(0);
    expect((await requestMembershipConsideration(CONSIDERATION)).ok).toBe(true);
  });

  it.each([
    ['no name', { fullName: '  ' }],
    ['a malformed email', { email: 'thandi@' }],
    ['an empty note', { considerationNote: '' }],
  ])('rejects %s without writing', async (_label, override) => {
    const result = await requestMembershipConsideration({ ...CONSIDERATION, ...override });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.collectorIntake.count()).toBe(0);
  });
});

describe('the journeys stay distinguishable', () => {
  it('tags each row with the journey that produced it', async () => {
    const { submitCollectorApplication } = await import('./actions');

    await submitCollectorApplication({ fullName: 'Intake Person', email: ONBOARDED });
    await requestMembershipConsideration(CONSIDERATION);

    const kinds = (
      await prisma.collectorIntake.findMany({
        orderBy: { createdAt: 'asc' },
        select: { kind: true },
      })
    ).map((row) => row.kind);

    expect(kinds).toEqual(['INTAKE', 'MEMBERSHIP_CONSIDERATION']);
  });

  it('leaves the existing intake defaulting to INTAKE', async () => {
    // The column was added to a live table. Anything written by the original
    // form must keep meaning exactly what it meant before.
    const { submitCollectorApplication } = await import('./actions');
    await submitCollectorApplication({ fullName: 'Thandi', email: 'plain@test.local' });

    expect((await prisma.collectorIntake.findFirstOrThrow()).kind).toBe('INTAKE');
  });
});
