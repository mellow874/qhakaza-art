'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@qhakaza/shared-auth/server';

import { commandCentreActor, isFailure, performAudited, readAs } from '@/lib/audit';

/**
 * Qhakaza working on an artist's record.
 *
 * THE DISTINCTION THIS FILE EXISTS TO KEEP. An artist DECLARES; Qhakaza
 * VERIFIES. Those are different acts by different people and they are stored
 * separately - `verification` says how well established a fact is,
 * `assertedVia`/`assertedById` says whose account it is. Nothing here
 * overwrites what the artist said; it records what Qhakaza found out about it.
 */

export type IntelligenceResult =
  { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** The five tables that carry a verifiable claim, and nothing else. */
const VERIFIABLE = ['exhibition', 'representation', 'cvEntry', 'signal', 'link'] as const;

const verifySchema = z.object({
  kind: z.enum(VERIFIABLE),
  id: z.string().min(1),
  verification: z.enum([
    'UNVERIFIED',
    'ARTIST_DECLARED',
    'DOCUMENT_ON_FILE',
    'INDEPENDENTLY_VERIFIED',
    'UNABLE_TO_VERIFY',
    'DISPUTED',
  ]),
  note: z.string().trim().max(2_000).optional(),
});

/**
 * Record what Qhakaza established about one claim.
 *
 * `UNABLE_TO_VERIFY` AND `DISPUTED` ARE FIRST-CLASS OUTCOMES, not failures to
 * be retried until they become something else. "We looked and could not
 * confirm it" is a finding, and a reviewer who can only record success will
 * either leave the field alone or overstate it.
 */
export async function recordVerification(input: unknown): Promise<IntelligenceResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const { kind, id, verification, note } = parsed.data;

  // A note is required whenever the outcome is anything other than a plain
  // confirmation. An unexplained "disputed" is an accusation without a reason.
  if ((verification === 'DISPUTED' || verification === 'UNABLE_TO_VERIFY') && !note) {
    return {
      ok: false,
      error: 'Say what could not be confirmed, or what contradicts it.',
      fieldErrors: { note: 'A reason is required for this outcome.' },
    };
  }

  const confirmed =
    verification === 'INDEPENDENTLY_VERIFIED' || verification === 'DOCUMENT_ON_FILE';

  try {
    await performAudited({
      actor,
      action: 'artist.verify',
      entityType: kind,
      entityId: id,
      summary: `${kind} recorded as ${verification}`,
      after: { verification, note: note ?? null },
      run: async (tx) => {
        const data = {
          verification,
          verificationNote: note ?? null,
          // Who verified it, kept apart from who asserted it. Cleared when the
          // outcome is not a confirmation, so a stale verifier is not left
          // attached to a claim that has since been queried.
          verifiedById: confirmed ? actor.userId : null,
          verifiedAt: confirmed ? new Date() : null,
        };

        switch (kind) {
          case 'exhibition':
            await tx.artistExhibition.update({ where: { id }, data });
            break;
          case 'representation':
            await tx.artistRepresentation.update({ where: { id }, data });
            break;
          case 'cvEntry':
            await tx.cvEntry.update({ where: { id }, data });
            break;
          case 'signal':
            await tx.institutionalSignal.update({ where: { id }, data });
            break;
          case 'link':
            // Links carry no verifier or note - they are checked, not
            // investigated, so only the state and the date apply.
            await tx.artistLink.update({
              where: { id },
              data: { verification, checkedAt: new Date() },
            });
            break;
        }
      },
    });
  } catch (error) {
    console.error('recordVerification failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artists');
  return { ok: true };
}

// ---------------------------------------------------------------------------

const permissionSchema = z.object({
  artistId: z.string().min(1),
  artworkId: z.string().min(1).nullable().optional(),
  kind: z.enum([
    'STORE_MATERIAL',
    'USE_INTERNALLY',
    'SHARE_PRIVATELY_WITH_COLLECTORS',
    'USE_IN_PRIVATE_BRIEF',
    'PRESENT_TO_PARTNERS',
    'PUBLISH_PUBLICLY',
    'PUBLISH_ARTIST_STORY',
    'RETAIN_DOCUMENTATION',
  ]),
  granted: z.boolean(),
  /** What the artist actually did. Required: a permission with no provenance is a claim. */
  confirmingAction: z.string().trim().min(1, 'Record what the artist did to confirm this').max(500),
  scopeNote: z.string().trim().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * Record a permission the artist has given or refused.
 *
 * STAFF RECORD IT; THE ARTIST GIVES IT. `confirmingAction` is mandatory
 * because this row is the evidence that the artist agreed - "they said yes on
 * a call on 12 March" is a record, an unexplained granted-true is not.
 *
 * A work-specific row and an artist-wide row can both exist. Which wins is not
 * decided here: see `decidePermission`, where more restrictive wins.
 */
export async function setArtistPermission(input: unknown): Promise<IntelligenceResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  // Only admins change what anyone is allowed to do. Advisors and analysts
  // read permissions and work within them.
  if (actor.role !== 'ADMIN') {
    return { ok: false, error: 'Only an administrator can change a permission.' };
  }

  const parsed = permissionSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const { artistId, artworkId, kind, granted, confirmingAction, scopeNote, expiresAt } =
    parsed.data;

  try {
    await performAudited({
      actor,
      action: 'artist.permission',
      entityType: 'ArtistPermission',
      entityId: artistId,
      summary: `${kind} ${granted ? 'granted' : 'refused'}${artworkId ? ' for one work' : ' across the artist record'}`,
      after: { kind, granted, artworkId: artworkId ?? null, confirmingAction },
      run: async (tx) => {
        /*
         * findFirst then create, NOT upsert.
         *
         * The unique key is (artistId, artworkId, kind) and an artist-wide row
         * has artworkId null - which a compound-unique upsert cannot match,
         * because null is not equal to null in SQL. This has caught the
         * project out before.
         */
        const existing = await tx.artistPermission.findFirst({
          where: { artistId, artworkId: artworkId ?? null, kind },
          select: { id: true },
        });

        const data = {
          granted,
          confirmingAction,
          scopeNote: scopeNote ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          decidedAt: new Date(),
        };

        if (existing) {
          await tx.artistPermission.update({ where: { id: existing.id }, data });
        } else {
          await tx.artistPermission.create({
            data: {
              ...data,
              artistId,
              artworkId: artworkId ?? null,
              kind,
              createdById: actor.userId,
            },
          });
        }

        await tx.recordChange.create({
          data: {
            subjectType: 'Artist',
            subjectId: artistId,
            field: `permission.${kind}`,
            previousValue: existing ? 'existing' : null,
            newValue: granted ? 'granted' : 'refused',
            reason: confirmingAction,
            changedById: actor.userId,
            changedRole: actor.role,
          },
        });
      },
    });
  } catch (error) {
    console.error('setArtistPermission failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artists');
  return { ok: true };
}

// ---------------------------------------------------------------------------

const assessmentSchema = z.object({
  artistId: z.string().min(1),
  summary: z.string().trim().max(5_000).optional(),
  recommendation: z.string().trim().max(2_000).optional(),
  ratings: z
    .array(
      z.object({
        criterionId: z.string().min(1),
        rating: z.string().trim().max(120).optional(),
        evidence: z.string().trim().max(2_000).optional(),
        concern: z.string().trim().max(2_000).optional(),
      }),
    )
    .max(50),
});

/**
 * Record an assessment of an artist against the readiness framework.
 *
 * APPEND-ONLY, and not by convention: `UPDATE` and `DELETE` are revoked from
 * the application role on both tables. A revised view is a NEW assessment that
 * points back at the one it supersedes, and the superseded row is untouched.
 * An assessment that could be edited would be worth nothing at the moment it
 * matters, which is when someone asks what was known and when.
 *
 * NEVER VISIBLE TO THE ARTIST. There is no artist grant on either table, so
 * this is enforced by the database rather than by every future query
 * remembering.
 *
 * NO SCORE IS COMPUTED. Ratings are labels from the criterion's own
 * vocabulary. Averaging them would produce a number nobody decided, and a
 * number is what people quote.
 */
export async function recordReadinessAssessment(input: unknown): Promise<IntelligenceResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const { artistId, summary, recommendation, ratings } = parsed.data;

  // An assessment against no criteria is not an assessment. This is the
  // failure staff will hit before Qhakaza has supplied the framework, so it
  // says what to do rather than reporting a validation error.
  const criteria = await readAs(actor, (tx) =>
    tx.readinessCriterion.count({ where: { active: true } }),
  );

  if (criteria === 0) {
    return {
      ok: false,
      error:
        'No readiness criteria have been set up yet. Add them under Lists before assessing an artist.',
    };
  }

  try {
    await performAudited({
      actor,
      action: 'artist.assess',
      entityType: 'ReadinessAssessment',
      entityId: artistId,
      summary: 'Readiness assessment recorded',
      after: { recommendation: recommendation ?? null, ratingCount: ratings.length },
      run: async (tx) => {
        // The assessment this one replaces, if any. The old row stays exactly
        // as it was; only the new one knows about the relationship.
        const previous = await tx.readinessAssessment.findFirst({
          where: { artistId, supersededBy: null },
          orderBy: { assessedAt: 'desc' },
          select: { id: true },
        });

        // The framework version in force, so a historical assessment keeps the
        // criteria it was actually made against.
        const methodology = await tx.methodologyVersion.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { effectiveFrom: 'desc' },
          select: { id: true },
        });

        const assessment = await tx.readinessAssessment.create({
          data: {
            artistId,
            summary: summary ?? null,
            recommendation: recommendation ?? null,
            assessedById: actor.userId,
            supersedesId: previous?.id ?? null,
            methodologyVersionId: methodology?.id ?? null,
            createdById: actor.userId,
          },
          select: { id: true },
        });

        for (const rating of ratings) {
          // Rows with nothing in them are skipped rather than stored empty: a
          // criterion left blank was not assessed, and recording it as an
          // empty rating would look like it was.
          if (!rating.rating && !rating.evidence && !rating.concern) continue;

          await tx.readinessRating.create({
            data: {
              assessmentId: assessment.id,
              criterionId: rating.criterionId,
              rating: rating.rating ?? null,
              evidence: rating.evidence ?? null,
              concern: rating.concern ?? null,
              createdById: actor.userId,
            },
          });
        }
      },
    });
  } catch (error) {
    console.error('recordReadinessAssessment failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artists');
  return { ok: true };
}
