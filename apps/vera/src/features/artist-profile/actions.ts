'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@qhakaza/shared-auth/server';
import { prisma, withActor } from '@qhakaza/shared-db';
import { artistProfileSchema } from '@/lib/validation/user';

import { slugCandidates } from './slug';

export type SaveResult =
  | { ok: true; slug: string }
  | {
      ok: false;
      error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID' | 'UNKNOWN';
      fieldErrors?: Record<string, string>;
    };

/**
 * Resolves the signed-in artist from the session and confirms they still exist
 * with the ARTIST role.
 *
 * The role is re-read from the database rather than trusted from the JWT: a
 * token issued before a role change would otherwise keep its old privileges
 * until it expired.
 */
type ArtistAuth =
  { ok: true; user: { id: string } } | { ok: false; error: 'UNAUTHENTICATED' | 'FORBIDDEN' };

async function requireArtist(): Promise<ArtistAuth> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  if (user.role !== 'ARTIST') return { ok: false, error: 'FORBIDDEN' };

  return { ok: true, user };
}

/** Creates or updates the signed-in artist's own storefront profile. */
export async function saveArtistProfile(input: unknown): Promise<SaveResult> {
  const authResult = await requireArtist();
  if (!authResult.ok) return { ok: false, error: authResult.error };

  const { user } = authResult;

  // Parsing against the schema is also what strips fields the client is not
  // allowed to set — `approved` in particular never survives this step.
  const parsed = artistProfileSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.');
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const { displayName, statement, socials } = parsed.data;

  const actor = { role: 'artist', userId: user.id } as const;

  try {
    // Reading one's own row is permitted by the `artist` policy.
    const existing = await withActor(actor, (tx) =>
      tx.artist.findUnique({ where: { userId: user.id }, select: { slug: true } }),
    );

    // The slug is a public URL. Minted once and then left alone, so renaming a
    // storefront never breaks inbound links.
    if (existing) {
      await withActor(actor, (tx) =>
        tx.artist.update({
          where: { userId: user.id },
          // `approved` and `slug` are deliberately absent: an artist editing
          // their profile must not be able to grant themselves approval, or
          // silently move their public URL.
          data: { displayName, statement: statement ?? null, socials: socials ?? undefined },
        }),
      );

      revalidatePath('/artist/dashboard');
      revalidatePath(`/artists/${existing.slug}`);
      return { ok: true, slug: existing.slug };
    }

    /*
     * First profile: claim a slug by trying to take it.
     *
     * The unique index is the only thing that knows what is free — an artist
     * cannot see other artists' rows, and even without RLS a check-then-insert
     * loses to a simultaneous signup. So each candidate is attempted and a
     * unique violation simply moves on to the next.
     */
    for (const candidate of slugCandidates(displayName)) {
      try {
        await withActor(actor, (tx) =>
          tx.artist.create({
            data: {
              userId: user.id,
              displayName,
              slug: candidate,
              statement: statement ?? null,
              socials: socials ?? undefined,
              createdById: user.id,
            },
          }),
        );

        revalidatePath('/artist/dashboard');
        revalidatePath(`/artists/${candidate}`);
        return { ok: true, slug: candidate };
      } catch (error) {
        if (isSlugConflict(error)) continue;
        throw error;
      }
    }

    console.error('saveArtistProfile: exhausted slug candidates for', displayName);
    return { ok: false, error: 'UNKNOWN' };
  } catch (error) {
    console.error('saveArtistProfile failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/**
 * A unique-constraint violation on `slug` specifically.
 *
 * Narrow on purpose: a clash on `userId` means this artist already has a
 * profile and retrying with a different slug would loop forever.
 */
function isSlugConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } };
  if (code !== 'P2002') return false;

  const target = meta?.target;
  return Array.isArray(target) ? target.includes('slug') : target === 'slug';
}

/** The signed-in artist's own profile, or null if they have not onboarded. */
export async function getMyArtistProfile() {
  const authResult = await requireArtist();
  if (!authResult.ok) return null;

  // The `artist` policy scopes this to their own row; the WHERE says the same
  // thing so the intent is readable without knowing the policy.
  return withActor({ role: 'artist', userId: authResult.user.id }, (tx) =>
    tx.artist.findUnique({ where: { userId: authResult.user.id } }),
  );
}
