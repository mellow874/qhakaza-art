import { createHash } from 'node:crypto';

import { asSystem } from './actor';

/**
 * Rate limiting for the public forms.
 *
 * WHY IT IS IN THE DATABASE. The apps run on Vercel, where each serverless
 * instance has its own memory. An in-memory limiter there counts a fraction of
 * the requests and lets the rest through - which is worse than having none,
 * because it reads as a control and is not one.
 *
 * WHY FIXED WINDOW. A caller can send the limit twice across a window
 * boundary. That is a real weakness and an acceptable one for what this
 * protects: public forms against flooding and casual abuse, not an API against
 * a determined attacker. The alternative costs a sweep job and more state than
 * the problem warrants, and pretending otherwise would be the more dishonest
 * choice.
 *
 * WHAT IT IS NOT. This is not authentication and not authorisation. Every
 * limited endpoint still checks who is asking and still fails closed if it
 * cannot tell.
 */

export type RateLimitVerdict = {
  allowed: boolean;
  /** How many remain in this window. Zero once the limit is reached. */
  remaining: number;
  /** When the current window ends, so a caller can be told when to try again. */
  resetsAt: Date;
};

export type RateLimitRule = {
  /** What is being limited: 'contact', 'intake', 'activation'. */
  action: string;
  /**
   * Who is being limited - usually an IP address, sometimes an email.
   *
   * HASHED BEFORE STORAGE. The bucket would otherwise be a table of who
   * submitted which form and when, which is personal data we have no reason to
   * keep in readable form for a counter.
   */
  subject: string;
  limit: number;
  windowSeconds: number;
};

/** The start of the fixed window `at` falls in. */
function windowStart(at: Date, windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(at.getTime() / ms) * ms);
}

function bucketFor(action: string, subject: string): string {
  const digest = createHash('sha256').update(subject).digest('hex').slice(0, 32);
  return `${action}:${digest}`;
}

/**
 * Count this request and say whether it is allowed.
 *
 * COUNTS FIRST, THEN DECIDES. The increment and the check are one statement,
 * so two requests arriving together cannot both read "count = limit - 1" and
 * both proceed. Doing it the other way round is the classic way a limiter
 * turns out not to limit anything under exactly the load it exists for.
 *
 * FAILS OPEN, deliberately. If the counter cannot be written the request is
 * allowed through: a database wobble should not take the contact form down.
 * That is the right trade here because nothing behind these endpoints is
 * destructive - it would be the wrong trade for a login, and a limiter on a
 * login should be written to fail closed instead.
 */
export async function consumeRateLimit(rule: RateLimitRule): Promise<RateLimitVerdict> {
  const now = new Date();
  const start = windowStart(now, rule.windowSeconds);
  const resetsAt = new Date(start.getTime() + rule.windowSeconds * 1000);
  const bucket = bucketFor(rule.action, rule.subject);

  try {
    const counter = await asSystem((tx) =>
      tx.rateLimitCounter.upsert({
        where: { bucket_windowStart: { bucket, windowStart: start } },
        create: { bucket, windowStart: start, count: 1 },
        update: { count: { increment: 1 } },
        select: { count: true },
      }),
    );

    return {
      allowed: counter.count <= rule.limit,
      remaining: Math.max(0, rule.limit - counter.count),
      resetsAt,
    };
  } catch (error) {
    console.error('rate limit check failed, allowing the request', error);
    return { allowed: true, remaining: rule.limit, resetsAt };
  }
}

/**
 * The limits, in one place.
 *
 * Named rather than passed as numbers at each call site, so that "how hard is
 * it to flood the contact form" is answerable by reading one object instead of
 * grepping for magic numbers.
 *
 * These are deliberately generous. A real person filling in a form twice
 * because the first attempt looked like it failed should never be turned away;
 * the number that matters is the one that stops a script.
 */
export const RATE_LIMITS = {
  /** The public contact form. */
  contact: { limit: 5, windowSeconds: 3_600 },
  /** Collector applications and access requests. */
  intake: { limit: 5, windowSeconds: 3_600 },
  /**
   * Presenting an invitation token. Tighter than the rest: repeated failures
   * here are what token guessing looks like, and a legitimate collector
   * follows a link once.
   */
  activation: { limit: 10, windowSeconds: 900 },
  /** Artist sign-up. */
  signup: { limit: 5, windowSeconds: 3_600 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Apply one of the named limits. */
export function checkLimit(name: RateLimitName, subject: string): Promise<RateLimitVerdict> {
  return consumeRateLimit({ action: name, subject, ...RATE_LIMITS[name] });
}

/**
 * Remove windows that have closed.
 *
 * Nothing calls this on a schedule yet, and the table is small enough that it
 * does not need one soon. It exists so the answer to "does this grow forever"
 * is a function rather than a shrug.
 */
export async function pruneRateLimits(olderThan: Date): Promise<number> {
  const { count } = await asSystem((tx) =>
    tx.rateLimitCounter.deleteMany({ where: { windowStart: { lt: olderThan } } }),
  );
  return count;
}
