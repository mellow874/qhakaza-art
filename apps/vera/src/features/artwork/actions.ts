'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@qhakaza/shared-auth/server';
import { prisma, withActor } from '@qhakaza/shared-db';

import { artPieceDraftSchema } from '@/lib/validation/art';

/**
 * Submitting a work.
 *
 * Saves as **DRAFT**, always. An artist can describe their work; only the
 * Command Center can release it, and only once the artist is approved. There is
 * deliberately no path from this form to PUBLISHED — that decision is not the
 * artist's to make, and a submission form that could publish would make vetting
 * decorative.
 *
 * IMAGES ARE URLS, NOT UPLOADS. No storage provider is configured, so the form
 * takes links to images that already exist somewhere. When an uploader is
 * added, only the field changes: the column is already `String[]`.
 */

export type SubmitArtworkResult =
  | { ok: true; artworkId: string }
  | {
      ok: false;
      error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NO_PROFILE' | 'INVALID' | 'UNKNOWN';
      fieldErrors?: Record<string, string>;
    };

export async function submitArtwork(input: unknown): Promise<SubmitArtworkResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };

  // Read the role from the database rather than trusting the token: one issued
  // before a role change would otherwise keep its old privileges until expiry.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  if (user.role !== 'ARTIST') return { ok: false, error: 'FORBIDDEN' };

  // The draft schema, not the listed one: a title is enough to save a work in
  // progress. The stricter rules apply when the Command Center releases it.
  const parsed = artPieceDraftSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const actor = { role: 'artist', userId } as const;

  try {
    const artwork = await withActor(actor, async (tx) => {
      const artist = await tx.artist.findUnique({ where: { userId }, select: { id: true } });
      // Work belongs to a profile, not to a user. Without one there is nothing
      // to attach it to, and the artist is sent to onboarding instead.
      if (!artist) return null;

      const { title, description, images, medium, dimensions, price, currency } = parsed.data;

      return tx.artwork.create({
        data: {
          artistId: artist.id,
          title,
          // Everything but the title is optional in a draft; the columns are
          // not nullable, so an unanswered field is stored as empty rather than
          // as invented content.
          description: description ?? '',
          images: images ?? [],
          medium: medium ?? '',
          dimensions: dimensions ?? '',
          price: price ?? 0,
          currency: currency ?? 'ZAR',
          // `status` is deliberately absent — the schema default is DRAFT, and
          // naming it here would invite someone to pass PUBLISHED one day.
          createdById: userId,
        },
        select: { id: true },
      });
    });

    if (!artwork) return { ok: false, error: 'NO_PROFILE' };

    revalidatePath('/artist/dashboard');
    return { ok: true, artworkId: artwork.id };
  } catch (error) {
    console.error('submitArtwork failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/**
 * Hand a work to Qhakaza for review.
 *
 * The only way out of DRAFT, and deliberately one-way: once submitted, an
 * artist cannot silently edit the record a reviewer is reading. If something
 * needs changing, the reviewer returns it with a question.
 *
 * Also the resubmission path. A work that came back as
 * RETURNED_FOR_INFORMATION goes to SUBMITTED again, which is what closes the
 * loop for the artist.
 */
export async function submitForReview(input: { artworkId: string }): Promise<SubmitArtworkResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== 'ARTIST') return { ok: false, error: 'FORBIDDEN' };

  try {
    const result = await withActor({ role: 'artist', userId }, async (tx) => {
      const artist = await tx.artist.findUnique({ where: { userId }, select: { id: true } });
      if (!artist) return null;

      // Guarded in the where clause: an artist may submit only their OWN work,
      // and only from a status that can be submitted.
      return tx.artwork.updateMany({
        where: {
          id: input.artworkId,
          artistId: artist.id,
          status: { in: ['DRAFT', 'RETURNED_FOR_INFORMATION'] },
        },
        data: { status: 'SUBMITTED' },
      });
    });

    if (result === null) return { ok: false, error: 'NO_PROFILE' };
    if (result.count === 0) return { ok: false, error: 'INVALID' };

    revalidatePath('/artist/dashboard');
    return { ok: true, artworkId: input.artworkId };
  } catch (error) {
    console.error('submitForReview failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/** The signed-in artist's own profile and work, for their dashboard. */
export async function getMyStudio() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  return withActor({ role: 'artist', userId }, async (tx) => {
    const artist = await tx.artist.findUnique({
      where: { userId },
      select: { id: true, displayName: true, slug: true, statement: true, approved: true },
    });

    if (!artist) return { artist: null, artworks: [] };

    const artworks = await tx.artwork.findMany({
      where: { artistId: artist.id },
      select: {
        id: true,
        title: true,
        medium: true,
        dimensions: true,
        price: true,
        currency: true,
        status: true,
        createdAt: true,
        // The open question, if a reviewer has asked one. Without this the
        // artist sees "returned for information" and no way to learn why.
        reviewRequests: {
          where: { resolvedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, request: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { artist, artworks };
  });
}
