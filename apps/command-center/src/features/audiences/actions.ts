'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@qhakaza/shared-auth/server';
import {
  decidePermission,
  profileFromSources,
  rankCollectorsForWork,
  rankWorksForCollector,
} from '@qhakaza/shared-db';

import { commandCentreActor, isFailure, performAudited, readAs } from '@/lib/audit';

/**
 * Placing work with collectors.
 *
 * RELEASING IS AN ACT, NOT A STATUS. Every function here that changes who can
 * see something is audited, and none of them happen as a side effect of
 * approval. The suggestion functions below deliberately return candidates and
 * stop - the admin decides.
 */

export type AudienceResult<T = undefined> =
  ({ ok: true } & (T extends undefined ? object : T)) | { ok: false; error: string };

/** Create a named group work can be placed with. */
export async function createAudience(input: {
  name: string;
  typeSlug?: string;
  description?: string;
}): Promise<AudienceResult<{ audienceId: string }>> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'An audience needs a name.' };

  let audienceId = '';

  try {
    await performAudited({
      actor,
      action: 'audience.create',
      entityType: 'Audience',
      summary: `Audience created: ${name}`,
      after: { name, type: input.typeSlug ?? null },
      run: async (tx) => {
        const type = input.typeSlug
          ? await tx.audienceType.findUnique({
              where: { slug: input.typeSlug },
              select: { id: true },
            })
          : null;

        const audience = await tx.audience.create({
          data: {
            name,
            description: input.description?.trim() || null,
            typeId: type?.id ?? null,
            createdById: actor.userId,
          },
          select: { id: true },
        });
        audienceId = audience.id;
      },
    });
  } catch (error) {
    console.error('createAudience failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true, audienceId };
}

/** Put a collector into an audience, or take them out again. */
export async function setAudienceMembership(input: {
  audienceId: string;
  membershipId: string;
  member: boolean;
}): Promise<AudienceResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  try {
    await performAudited({
      actor,
      action: input.member ? 'audience.add' : 'audience.remove',
      entityType: 'Audience',
      entityId: input.audienceId,
      summary: input.member ? 'Collector added to audience' : 'Collector removed from audience',
      after: { membershipId: input.membershipId, member: input.member },
      run: async (tx) => {
        const existing = await tx.audienceMember.findFirst({
          where: { audienceId: input.audienceId, membershipId: input.membershipId },
          select: { id: true },
        });

        if (input.member) {
          // Rejoining clears the removal rather than writing a second row, so
          // the audience never holds two entries for one person.
          if (existing) {
            await tx.audienceMember.update({
              where: { id: existing.id },
              data: { removedAt: null },
            });
          } else {
            await tx.audienceMember.create({
              data: {
                audienceId: input.audienceId,
                membershipId: input.membershipId,
                addedById: actor.userId,
                createdById: actor.userId,
              },
            });
          }
        } else if (existing) {
          // Never deleted: who could see what, and when, is provenance.
          await tx.audienceMember.update({
            where: { id: existing.id },
            data: { removedAt: new Date() },
          });
        }
      },
    });
  } catch (error) {
    console.error('setAudienceMembership failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true };
}

/**
 * Place a work with an audience.
 *
 * The one action that makes something visible to someone. It refuses work that
 * is not collector-ready, and refuses outright if the artist has not permitted
 * the kind of sharing being asked for - the permission is the artist's, and no
 * amount of internal approval substitutes for it.
 */
export async function releaseArtwork(input: {
  artworkId: string;
  audienceId: string;
  tier?: 'PRIVATE_COLLECTOR_PROJECTION' | 'PUBLIC_EDITORIAL';
  reason?: string;
  versionLabel?: string;
}): Promise<AudienceResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const tier = input.tier ?? 'PRIVATE_COLLECTOR_PROJECTION';
  const requiredPermission =
    tier === 'PUBLIC_EDITORIAL' ? 'PUBLISH_PUBLICLY' : 'SHARE_PRIVATELY_WITH_COLLECTORS';

  const artwork = await readAs(actor, (tx) =>
    tx.artwork.findUnique({
      where: { id: input.artworkId },
      select: { id: true, title: true, status: true, artistId: true },
    }),
  );

  if (!artwork) return { ok: false, error: 'NOT_FOUND' };

  const releasable = ['APPROVED', 'COLLECTOR_READY', 'RELEASED_TO_AUDIENCE', 'PUBLIC_EDITORIAL'];
  if (!releasable.includes(artwork.status)) {
    return { ok: false, error: `A work that is ${artwork.status} cannot be placed with anyone.` };
  }

  /*
   * EVERY row for this artist and kind, granted and denied alike.
   *
   * This query used to carry `granted: true` and take the first hit, which
   * meant an artist-wide grant answered for a work-specific refusal and the
   * work was released anyway. Filtering to grants before deciding removes
   * exactly the rows that decide. `decidePermission` applies the rule.
   */
  const permissions = await readAs(actor, (tx) =>
    tx.artistPermission.findMany({
      where: {
        artistId: artwork.artistId,
        kind: requiredPermission as 'PUBLISH_PUBLICLY',
        OR: [{ artworkId: null }, { artworkId: artwork.id }],
      },
      select: { artworkId: true, granted: true, expiresAt: true },
    }),
  );

  if (!decidePermission(permissions, artwork.id)) {
    return {
      ok: false,
      error:
        tier === 'PUBLIC_EDITORIAL'
          ? 'The artist has not permitted public publication of this work.'
          : 'The artist has not permitted private sharing of this work.',
    };
  }

  try {
    await performAudited({
      actor,
      action: 'artwork.release',
      entityType: 'Artwork',
      entityId: artwork.id,
      summary: `${artwork.title} placed with an audience (${tier})`,
      before: { status: artwork.status },
      after: { tier, audienceId: input.audienceId, reason: input.reason ?? null },
      run: async (tx) => {
        await tx.artworkRelease.create({
          data: {
            artworkId: artwork.id,
            audienceId: input.audienceId,
            tier,
            reason: input.reason?.trim() || null,
            versionLabel: input.versionLabel?.trim() || null,
            releasedById: actor.userId,
            createdById: actor.userId,
          },
        });

        await tx.artwork.update({
          where: { id: artwork.id },
          data: {
            status: tier === 'PUBLIC_EDITORIAL' ? 'PUBLIC_EDITORIAL' : 'RELEASED_TO_AUDIENCE',
          },
        });
      },
    });
  } catch (error) {
    console.error('releaseArtwork failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true };
}

/** Take a work back. The release row stays; it is marked revoked. */
export async function revokeRelease(input: { releaseId: string }): Promise<AudienceResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  try {
    await performAudited({
      actor,
      action: 'artwork.release.revoke',
      entityType: 'ArtworkRelease',
      entityId: input.releaseId,
      summary: 'Release revoked',
      run: async (tx) => {
        await tx.artworkRelease.updateMany({
          where: { id: input.releaseId, revokedAt: null },
          data: { revokedAt: new Date(), revokedById: actor.userId },
        });
      },
    });
  } catch (error) {
    console.error('revokeRelease failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Suggestions. These read; they never write a release.
// ---------------------------------------------------------------------------

/** Collectors who might suit a work, best first. */
export async function suggestCollectorsFor(artworkId: string) {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return [];

  return readAs(actor, async (tx) => {
    const work = await tx.artwork.findUnique({
      where: { id: artworkId },
      select: { id: true, title: true, medium: true, themes: true },
    });
    if (!work) return [];

    const profiles = await tx.collectorProfile.findMany({
      select: {
        membershipId: true,
        mediums: true,
        themes: true,
        regions: true,
        membership: { select: { intake: { select: { fullName: true } } } },
      },
    });

    return rankCollectorsForWork(
      { ...work, artistCountry: null },
      profiles.map((profile) => ({
        membershipId: profile.membershipId,
        name: profile.membership?.intake?.fullName ?? null,
        mediums: profile.mediums,
        themes: profile.themes,
        regions: profile.regions,
      })),
    );
  });
}

/** Work that might suit a collector, best first. */
export async function suggestWorksFor(membershipId: string) {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return [];

  return readAs(actor, async (tx) => {
    const profile = await tx.collectorProfile.findUnique({
      where: { membershipId },
      select: { membershipId: true, mediums: true, themes: true, regions: true },
    });
    if (!profile) return [];

    // Only work that could actually be placed. Suggesting a draft would invite
    // an admin to try something the release action will refuse.
    const works = await tx.artwork.findMany({
      where: { status: { in: ['APPROVED', 'COLLECTOR_READY'] } },
      select: { id: true, title: true, medium: true, themes: true },
      take: 200,
    });

    return rankWorksForCollector(
      { ...profile, name: null },
      works.map((work) => ({ ...work, artistCountry: null })),
    );
  });
}

/**
 * Build or refresh a collector's profile from what they have already told us.
 *
 * Nothing is invented: a field neither the intake nor the Private Note
 * supplied stays empty. An advisor's own edits are not overwritten, because
 * this runs again whenever new material arrives.
 */
export async function syncCollectorProfile(input: {
  membershipId: string;
}): Promise<AudienceResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  try {
    await performAudited({
      actor,
      action: 'collector.profile.sync',
      entityType: 'CollectorProfile',
      summary: 'Collector profile refreshed from intake and Private Note',
      after: { membershipId: input.membershipId },
      run: async (tx) => {
        const membership = await tx.membership.findUnique({
          where: { id: input.membershipId },
          select: {
            intake: {
              select: { preferredMediums: true, country: true, collectingGoal: true, email: true },
            },
          },
        });

        const note = membership?.intake?.email
          ? await tx.privateNote.findFirst({
              where: { email: membership.intake.email },
              orderBy: { createdAt: 'desc' },
              select: {
                mediums: true,
                regions: true,
                subjects: true,
                budgetBand: true,
                acquisitionPace: true,
                building: true,
              },
            })
          : null;

        const derived = profileFromSources({ intake: membership?.intake ?? null, note });

        const existing = await tx.collectorProfile.findUnique({
          where: { membershipId: input.membershipId },
          select: { id: true },
        });

        if (existing) {
          await tx.collectorProfile.update({ where: { id: existing.id }, data: derived });
        } else {
          await tx.collectorProfile.create({
            data: { membershipId: input.membershipId, ...derived, createdById: actor.userId },
          });
        }
      },
    });
  } catch (error) {
    console.error('syncCollectorProfile failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true };
}
