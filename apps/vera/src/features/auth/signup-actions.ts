'use server';

import bcrypt from 'bcryptjs';

import { prisma } from '@qhakaza/shared-db';

import { signUpSchema } from '@/lib/validation/user';

export type SignUpResult =
  | { ok: true }
  | { ok: false; error: 'INVALID' | 'TAKEN' | 'UNKNOWN'; fieldErrors?: Record<string, string> };

/**
 * Creates an account.
 *
 * `signUpSchema` restricts `role` to ARTIST or COLLECTOR, so ADMIN and ADVISOR
 * cannot be self-assigned — staff are provisioned in the Command Center. That
 * is the whole reason the role is parsed rather than read off the request.
 */
export async function signUp(input: unknown): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const { name, email, password, role } = parsed.data;

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
      data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) },
    });

    return { ok: true };
  } catch (error) {
    // The password is in `parsed.data`; only the error is ever logged.
    console.error('signUp failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
