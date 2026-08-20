'use server';

import bcrypt from 'bcryptjs';

import { newAccountSchema } from '@qhakaza/shared-auth';
import { prisma } from '@qhakaza/shared-db';

export type SignUpResult =
  | { ok: true }
  | { ok: false; error: 'INVALID' | 'TAKEN' | 'UNKNOWN'; fieldErrors?: Record<string, string> };

/**
 * Creates a **collector** account.
 *
 * The Collector Platform's own sign-up, added when the artist platform's
 * became artist-only.
 * A collector needs an account *before* they can open an invitation to
 * `/private/<token>`, so removing the choice from the artist platform without
 * putting a door
 * here would have left invitees with no way in.
 *
 * An account is not access. It grants nothing on its own — the private area
 * still requires a valid invitation token, which only the Command Center
 * issues. This is a sign-in identity, not a membership.
 */
export async function signUpCollector(input: unknown): Promise<SignUpResult> {
  const parsed = newAccountSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return {
        ok: false,
        error: 'TAKEN',
        fieldErrors: { email: 'An account with that email already exists' },
      };
    }

    // COLLECTOR, fixed here. Never from the payload.
    await prisma.user.create({
      data: { name, email, role: 'COLLECTOR', passwordHash: await bcrypt.hash(password, 10) },
    });

    return { ok: true };
  } catch (error) {
    console.error('signUpCollector failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
