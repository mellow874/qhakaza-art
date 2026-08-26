import { asSystem } from './actor';

/**
 * Recording what happens on the platform.
 *
 * WHY THIS EXISTS. `AnalyticsEvent` has been in the schema since Phase 6 and
 * the Command Center dashboard reads from it, but nothing anywhere ever wrote
 * a row. The panel was therefore permanently empty - honestly empty rather
 * than filled with invented numbers, which was the right call at the time, but
 * empty because the events were never recorded rather than because nothing had
 * happened.
 *
 * WHAT IS RECORDED, AND WHAT IS NOT. Business events only: an application
 * arrived, an invitation was accepted, a work was placed. There is no page
 * tracking, no session stitching and no behavioural profile of anybody.
 *
 * The platform's premise is privacy. An analytics table that quietly became a
 * record of what each collector looked at and when would contradict the thing
 * being sold, so `actorId` is recorded only where the actor is staff acting in
 * their own name, and `properties` carries counts and identifiers rather than
 * anything a person typed.
 */

/**
 * The events worth recording, and nothing else.
 *
 * A CLOSED LIST on purpose. An open `record(name, props)` becomes a hundred
 * ad-hoc event names within a year, at which point nobody can answer what is
 * being collected - which is precisely the question this platform has to be
 * able to answer about itself.
 */
export const ANALYTICS_EVENTS = [
  'intake.submitted',
  'intake.verified',
  'invitation.issued',
  'invitation.accepted',
  'invitation.failed',
  'artist.joined',
  'artist.approved',
  'artwork.submitted',
  'artwork.released',
  'contact.submitted',
  'rate_limit.tripped',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/**
 * Record that something happened.
 *
 * NEVER THROWS, and never blocks the thing it is recording. Analytics is the
 * least important write in any request it appears in - a dashboard that misses
 * an event is a nuisance, an invitation that failed to send because a metric
 * could not be stored is a real problem.
 *
 * This deliberately does NOT join the caller's transaction. `performAudited`
 * does, because an action that cannot be audited must not happen; the opposite
 * is true here, and putting analytics inside that transaction would give a
 * metrics failure the power to roll back real work.
 */
export async function recordEvent(
  name: AnalyticsEventName,
  input: {
    /** Only where the actor is staff acting in their own name. */
    actorId?: string | null;
    /** Counts and identifiers. Never anything a person typed. */
    properties?: Record<string, string | number | boolean | null>;
  } = {},
): Promise<void> {
  try {
    await asSystem((tx) =>
      tx.analyticsEvent.create({
        data: {
          name,
          actorId: input.actorId ?? null,
          properties: input.properties ?? undefined,
        },
      }),
    );
  } catch (error) {
    // Logged, not raised. See above.
    console.error(`analytics: could not record ${name}`, error);
  }
}
