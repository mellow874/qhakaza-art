'use server';

import bcrypt from 'bcryptjs';

import { newAccountSchema } from '@qhakaza/shared-auth';
import { prisma } from '@qhakaza/shared-db';

export type SignUpResult =
  | { ok: true }
  | { ok: false; error: 'INVALID' | 'TAKEN' | 'UNKNOWN'; fieldErrors?: Record<string, string> };

/**
 * Creates an **artist** account.
 *
 * The role is fixed here, not carried in the payload. Vera is the artist site
 * and makes artists; collectors sign up on the Collector Platform. A role the
 * browser could choose is a role an attacker could choose, and the previous
 * version's Artist/Collector selector was also a question no visitor to an
 * artist site should have to answer.
 */
export async function signUp(input: unknown): Promise<SignUpResult> {
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

    await prisma.user.create({
      data: { name, email, role: 'ARTIST', passwordHash: await bcrypt.hash(password, 10) },
    });

    return { ok: true };
  } catch (error) {
    // The password is in `parsed.data`; only the error is ever logged.
    console.error('signUp failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
