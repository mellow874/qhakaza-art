'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { artistProfileSchema } from '@/lib/validation/user';

import { uniqueSlug } from './slug';

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

  try {
    const existing = await prisma.artistProfile.findUnique({ where: { userId: user.id } });

    // The slug is a public URL. It is minted once and then left alone, so
    // renaming a storefront never breaks inbound links.
    const slug =
      existing?.slug ??
      (await uniqueSlug(displayName, async (candidate) => {
        const clash = await prisma.artistProfile.findUnique({ where: { slug: candidate } });
        return clash !== null;
      }));

    await prisma.artistProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName,
        slug,
        statement: statement ?? null,
        socials: socials ?? undefined,
      },
      // `approved` is deliberately absent: an artist editing their profile
      // must not be able to grant, or lose, their own approval.
      update: {
        displayName,
        statement: statement ?? null,
        socials: socials ?? undefined,
      },
    });

    revalidatePath('/artist/dashboard');
    revalidatePath(`/artists/${slug}`);

    return { ok: true, slug };
  } catch (error) {
    console.error('saveArtistProfile failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/** The signed-in artist's own profile, or null if they have not onboarded. */
export async function getMyArtistProfile() {
  const authResult = await requireArtist();
  if (!authResult.ok) return null;

  return prisma.artistProfile.findUnique({ where: { userId: authResult.user.id } });
}
