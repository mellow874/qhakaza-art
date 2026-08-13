import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@qhakaza/shared-db';

const { requestAccess, requestMembershipConsideration } = await import('./journey-actions');

const ONBOARDED = 'onboarded@test.local';

const CONSIDERATION = {
  fullName: 'Thandi Mokoena',
  email: 'thandi@test.local',
  considerationNote: 'I would like to join but cannot meet the annual fee this year.',
};

beforeEach(async () => {
  await prisma.collectorIntake.deleteMany();
});

describe('requestAccess', () => {
  it('records a request from someone who has onboarded', async () => {
    await prisma.collectorIntake.createMany({
      data: [{ kind: 'INTAKE', fullName: 'Already Onboarded', email: ONBOARDED }],
    });

    const result = await requestAccess({
      email: ONBOARDED,
      accessInterest: 'I would like to see more of the mixed-media work.',
    });

    expect(result.ok).toBe(true);
    const row = await prisma.collectorIntake.findFirstOrThrow({
      where: { kind: 'ACCESS_REQUEST' },
    });
    expect(row.email).toBe(ONBOARDED);
    expect(row.accessInterest).toContain('mixed-media');
  });

  it('refuses someone who has never onboarded, and writes nothing', async () => {
    // Access follows onboarding. Without this the gate is decorative.
    const result = await requestAccess({
      email: 'stranger@test.local',
      accessInterest: 'I would like to see everything you have.',
    });

    expect(result).toMatchObject({ ok: false, error: 'NO_INTAKE' });
    expect(await prisma.collectorIntake.count()).toBe(0);
  });

  it('does not accept a previous access request as onboarding', async () => {
    // Otherwise the first refusal would leave a row that satisfies the gate on
    // the second attempt, and the precondition would defeat itself.
    await prisma.collectorIntake.createMany({
      data: [{ kind: 'ACCESS_REQUEST', fullName: 'x', email: ONBOARDED, accessInterest: 'x' }],
    });

    const result = await requestAccess({
      email: ONBOARDED,
      accessInterest: 'Trying again after being refused.',
    });

    expect(result).toMatchObject({ ok: false, error: 'NO_INTAKE' });
  });

  it('matches the address regardless of how it was typed', async () => {
    await prisma.collectorIntake.createMany({
      data: [{ kind: 'INTAKE', fullName: 'Already Onboarded', email: ONBOARDED }],
    });

    const result = await requestAccess({
      email: `  ${ONBOARDED.toUpperCase()} `,
      accessInterest: 'Case and spacing should not matter here.',
    });

    expect(result.ok).toBe(true);
  });

  it.each([
    ['a malformed email', { email: 'not-an-address' }],
    ['no detail', { accessInterest: 'hi' }],
  ])('rejects %s without writing', async (_label, override) => {
    const result = await requestAccess({
      email: ONBOARDED,
      accessInterest: 'A perfectly reasonable request.',
      ...override,
    });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.collectorIntake.count()).toBe(0);
  });
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

describe('the three journeys stay distinguishable', () => {
  it('tags each row with the journey that produced it', async () => {
    const { submitCollectorApplication } = await import('./actions');

    await submitCollectorApplication({ fullName: 'Intake Person', email: ONBOARDED });
    await requestAccess({ email: ONBOARDED, accessInterest: 'Something specific, please.' });
    await requestMembershipConsideration(CONSIDERATION);

    const kinds = (
      await prisma.collectorIntake.findMany({
        orderBy: { createdAt: 'asc' },
        select: { kind: true },
      })
    ).map((row) => row.kind);

    expect(kinds).toEqual(['INTAKE', 'ACCESS_REQUEST', 'MEMBERSHIP_CONSIDERATION']);
  });

  it('leaves the existing intake defaulting to INTAKE', async () => {
    // The column was added to a live table. Anything written by the original
    // form must keep meaning exactly what it meant before.
    const { submitCollectorApplication } = await import('./actions');
    await submitCollectorApplication({ fullName: 'Thandi', email: 'plain@test.local' });

    expect((await prisma.collectorIntake.findFirstOrThrow()).kind).toBe('INTAKE');
  });
});
