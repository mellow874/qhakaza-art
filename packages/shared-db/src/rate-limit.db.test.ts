import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from './client';
import { ANALYTICS_EVENTS, recordEvent } from './analytics';
import { checkLimit, consumeRateLimit, pruneRateLimits, RATE_LIMITS } from './rate-limit';

/**
 * Rate limiting and event recording.
 *
 * The assertions that matter are about the boundary: that the limit is the
 * limit and not one more, that different callers do not share an allowance,
 * and that a caller's identity is not sitting in the table in readable form.
 */

const rand = () => Math.random().toString(36).slice(2, 10);

beforeEach(async () => {
  await prisma.rateLimitCounter.deleteMany();
  await prisma.analyticsEvent.deleteMany();
});

describe('the limit is the limit', () => {
  it('allows exactly as many as it says and no more', async () => {
    const rule = { action: `t-${rand()}`, subject: '203.0.113.5', limit: 3, windowSeconds: 3_600 };

    const verdicts = [
      await consumeRateLimit(rule),
      await consumeRateLimit(rule),
      await consumeRateLimit(rule),
      await consumeRateLimit(rule),
    ];

    expect(verdicts.map((v) => v.allowed)).toEqual([true, true, true, false]);
    expect(verdicts[2].remaining).toBe(0);
  });

  it('counts each caller separately', async () => {
    const action = `t-${rand()}`;
    const rule = { action, limit: 1, windowSeconds: 3_600 };

    expect((await consumeRateLimit({ ...rule, subject: 'a' })).allowed).toBe(true);
    // A second caller is unaffected by the first having used theirs.
    expect((await consumeRateLimit({ ...rule, subject: 'b' })).allowed).toBe(true);
    expect((await consumeRateLimit({ ...rule, subject: 'a' })).allowed).toBe(false);
  });

  it('counts each action separately', async () => {
    const subject = '203.0.113.5';

    expect(
      (await consumeRateLimit({ action: `x-${rand()}`, subject, limit: 1, windowSeconds: 3_600 }))
        .allowed,
    ).toBe(true);
    expect(
      (await consumeRateLimit({ action: `y-${rand()}`, subject, limit: 1, windowSeconds: 3_600 }))
        .allowed,
    ).toBe(true);
  });

  it('holds one row per caller per window rather than one per request', async () => {
    const rule = { action: `t-${rand()}`, subject: 'someone', limit: 10, windowSeconds: 3_600 };

    await consumeRateLimit(rule);
    await consumeRateLimit(rule);
    await consumeRateLimit(rule);

    const rows = await prisma.rateLimitCounter.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(3);
  });

  it('says when the window ends', async () => {
    const verdict = await consumeRateLimit({
      action: `t-${rand()}`,
      subject: 'someone',
      limit: 1,
      windowSeconds: 3_600,
    });

    // Somewhere in the next hour, and never in the past.
    expect(verdict.resetsAt.getTime()).toBeGreaterThan(Date.now());
    expect(verdict.resetsAt.getTime()).toBeLessThanOrEqual(Date.now() + 3_600_000);
  });
});

describe('what the table holds', () => {
  it('does not store the caller in readable form', async () => {
    /*
     * The bucket would otherwise be a list of who submitted which form and
     * when. It is a counter; it has no business being a log of people.
     */
    await consumeRateLimit({
      action: 'contact',
      subject: '203.0.113.5',
      limit: 5,
      windowSeconds: 3_600,
    });

    const row = await prisma.rateLimitCounter.findFirstOrThrow();
    expect(row.bucket).toContain('contact');
    expect(row.bucket).not.toContain('203.0.113.5');
  });

  it('can be pruned once its windows have closed', async () => {
    await consumeRateLimit({
      action: `t-${rand()}`,
      subject: 'someone',
      limit: 1,
      windowSeconds: 60,
    });

    // Nothing is old yet.
    expect(await pruneRateLimits(new Date(Date.now() - 86_400_000))).toBe(0);
    // Everything is old now.
    expect(await pruneRateLimits(new Date(Date.now() + 86_400_000))).toBe(1);
    expect(await prisma.rateLimitCounter.count()).toBe(0);
  });
});

describe('the named limits', () => {
  it('applies the configured limit for a named action', async () => {
    const subject = `caller-${rand()}`;

    for (let attempt = 0; attempt < RATE_LIMITS.contact.limit; attempt += 1) {
      expect((await checkLimit('contact', subject)).allowed).toBe(true);
    }

    expect((await checkLimit('contact', subject)).allowed).toBe(false);
  });

  it('is tighter on invitation activation than on the public forms', async () => {
    /*
     * Repeated attempts at a token are what guessing looks like, so its window
     * is shorter than the forms'. Asserted rather than left as a comment,
     * because a later edit that loosened it would otherwise go unnoticed.
     */
    expect(RATE_LIMITS.activation.windowSeconds).toBeLessThan(RATE_LIMITS.contact.windowSeconds);
  });
});

describe('recording events', () => {
  it('records one', async () => {
    await recordEvent('contact.submitted');

    const event = await prisma.analyticsEvent.findFirstOrThrow();
    expect(event.name).toBe('contact.submitted');
  });

  it('never throws, whatever happens', async () => {
    // Analytics is the least important write in any request it appears in.
    // An invitation must not fail because a metric could not be stored.
    await expect(
      // @ts-expect-error - deliberately invalid, to prove it is swallowed.
      recordEvent('not.a.real.event'),
    ).resolves.toBeUndefined();
  });

  it('carries no personal detail on an intake', async () => {
    /*
     * The intake payload holds income bands and free text about someone's
     * wealth. That one arrived is the metric; what it said is not.
     */
    await recordEvent('intake.submitted');

    const event = await prisma.analyticsEvent.findFirstOrThrow();
    expect(event.properties).toBeNull();
    expect(event.actorId).toBeNull();
  });

  it('keeps the event vocabulary closed and small', async () => {
    // An open recorder becomes a hundred ad-hoc names within a year, at which
    // point nobody can answer what is being collected.
    expect(ANALYTICS_EVENTS.length).toBeLessThanOrEqual(20);
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });
});
