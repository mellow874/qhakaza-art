'use server';

import { randomBytes } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { fingerprintToken } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';
import { emailIsConfigured, emailServiceFromEnv, invitationEmail } from '@qhakaza/shared-email';

import {
  commandCentreActor,
  isFailure,
  performAudited,
  readAs,
  type AuditActor,
} from '@/lib/audit';

import { invitationInputSchema } from '@/lib/validation/invitation';

/**
 * The invitation workflow.
 *
 *   CREATED -> SENT -> OPENED -> ACCEPTED -> COMPLETED
 *   plus EXPIRED and CANCELLED
 *
 * Separate from `command-center/actions.ts` because that file's
 * `inviteCollector` does a narrower job: it invites an already-verified intake
 * and nothing else. This module invites anyone, of any type, by name and email.
 * Both are kept — the intake route is still the right one when an application
 * has just been accepted, and it now delegates its sending here.
 *
 * THE TOKEN IS SHOWN ONCE.
 * Only `fingerprintToken(token)` is stored. That is deliberate: a stolen
 * database yields no working invitation links. The consequence is that
 * "resend the same link" is impossible, because nothing anywhere can reproduce
 * it. `resendInvitation` therefore issues a NEW link and cancels the old one,
 * which is a different behaviour from what the word "resend" implies. Flagged
 * to Qhakaza rather than quietly redefined.
 */

const INVITATION_DAYS = 14;

export type InvitationResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Where an invitation link points, by recipient type. */
function invitationUrl(typeSlug: string, token: string): string {
  // Each site is its own deployment, so these are absolute. The fallbacks are
  // the development ports; production sets both variables.
  const collectorBase = process.env.NEXT_PUBLIC_COLLECTOR_URL ?? 'http://localhost:3002';
  const veraBase = process.env.NEXT_PUBLIC_VERA_URL ?? 'http://localhost:3001';

  return typeSlug.toUpperCase() === 'ARTIST'
    ? `${veraBase}/invitation/${token}`
    : `${collectorBase}/private/${token}`;
}

/** The recipient types an admin may choose from. Data, not a hardcoded list. */
export async function getRecipientTypes() {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return [];

  return readAs(actor, (tx) =>
    tx.invitationRecipientType.findMany({
      where: { active: true },
      orderBy: { ordering: 'asc' },
      select: { id: true, slug: true, label: true },
    }),
  );
}

/**
 * Create an invitation and try to send it.
 *
 * Creation and sending are one action from the operator's point of view, but
 * two states in the record: a send that fails still leaves a usable invitation
 * whose link the admin can copy. Email is best-effort by design — the platform
 * must work before the provider is connected.
 */
export async function createInvitation(input: unknown): Promise<
  InvitationResult<{ invitationId: string; link: string; emailed: boolean; emailError?: string }>
> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = invitationInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const { recipientName, email, recipientTypeId } = parsed.data;

  const type = await readAs(actor, (tx) =>
    tx.invitationRecipientType.findUnique({
      where: { id: recipientTypeId },
      select: { id: true, slug: true, label: true, active: true },
    }),
  );

  if (!type?.active) return { ok: false, error: 'UNKNOWN_RECIPIENT_TYPE' };

  /*
   * One live invitation per address per type.
   *
   * Without this, pressing the button twice creates two valid links, and two
   * links means two chances to create an account for one person. The database
   * cannot express "unique among rows in these states", so it is checked here
   * and the single-use guard at acceptance is the real backstop.
   */
  const existing = await readAs(actor, (tx) =>
    tx.memberInvitation.findFirst({
      where: {
        email,
        recipientTypeId: type.id,
        status: { in: ['CREATED', 'SENT', 'OPENED'] },
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }),
  );

  if (existing) return { ok: false, error: 'ALREADY_INVITED' };

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);

  let invitationId = '';

  try {
    await performAudited({
      actor,
      action: 'invitation.create',
      entityType: 'MemberInvitation',
      summary: `Invitation created for ${recipientName ?? email} (${type.label})`,
      after: { email, recipientType: type.slug, expiresAt: expiresAt.toISOString() },
      run: async (tx) => {
        const created = await tx.memberInvitation.create({
          data: {
            email,
            recipientName,
            recipientTypeId: type.id,
            tokenHash: fingerprintToken(token),
            status: 'CREATED',
            expiresAt,
            createdById: actor.userId,
          },
          select: { id: true },
        });
        invitationId = created.id;
      },
    });
  } catch (error) {
    console.error('createInvitation failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  const link = invitationUrl(type.slug, token);
  const sent = await deliver({ actor, invitationId, type, recipientName, email, link, expiresAt });

  revalidatePath('/');

  return {
    ok: true,
    invitationId,
    link,
    emailed: sent.ok,
    ...(sent.ok ? {} : { emailError: sent.error }),
  };
}

/** Hand the message to the email layer and record the outcome on the row. */
async function deliver(input: {
  actor: AuditActor;
  invitationId: string;
  type: { slug: string; label: string };
  recipientName: string | null;
  email: string;
  link: string;
  expiresAt: Date;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = invitationEmail(input.type.slug, {
    recipientName: input.recipientName,
    recipientTypeLabel: input.type.label,
    link: input.link,
    expiresAt: input.expiresAt,
  });

  const result = await emailServiceFromEnv().send({ to: input.email, ...message });

  if (!result.ok) {
    // The invitation still exists and its link still works. Left at CREATED so
    // the UI can show it as not yet sent, with the link to copy.
    console.error('invitation email failed', result.error);
    return { ok: false, error: result.error };
  }

  // Only mark SENT when a provider actually accepted it. With the logging
  // service that is still true — it accepted it into the log, and the UI says
  // plainly that email is not connected.
  try {
    await performAudited({
      actor: input.actor,
      action: 'invitation.send',
      entityType: 'MemberInvitation',
      entityId: input.invitationId,
      summary: `Invitation sent to ${input.email} via ${result.provider}`,
      after: { provider: result.provider },
      run: (tx) =>
        tx.memberInvitation.updateMany({
          where: { id: input.invitationId, status: 'CREATED' },
          data: { status: 'SENT', sentAt: new Date(), sentById: input.actor.userId },
        }),
    });
  } catch (error) {
    console.error('recording invitation send failed', error);
  }

  return { ok: true };
}

/**
 * Issue a replacement invitation.
 *
 * NOT a true resend — see the note at the top of this file. The original link
 * cannot be reproduced, so this cancels it and creates a fresh one. Doing it
 * this way also means a link that may have been forwarded stops working.
 */
export async function resendInvitation(input: {
  invitationId: string;
}): Promise<InvitationResult<{ link: string; emailed: boolean }>> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const original = await readAs(actor, (tx) =>
    tx.memberInvitation.findUnique({
      where: { id: input.invitationId },
      select: {
        id: true,
        email: true,
        recipientName: true,
        recipientTypeId: true,
        status: true,
        recipientType: { select: { id: true, slug: true, label: true } },
      },
    }),
  );

  if (!original) return { ok: false, error: 'NOT_FOUND' };

  // An accepted invitation has already done its job. Reissuing would hand out
  // a second route to an account that exists.
  if (original.status === 'ACCEPTED' || original.status === 'COMPLETED') {
    return { ok: false, error: 'ALREADY_ACCEPTED' };
  }

  try {
    await performAudited({
      actor,
      action: 'invitation.cancel',
      entityType: 'MemberInvitation',
      entityId: original.id,
      summary: `Invitation to ${original.email} superseded by a reissue`,
      before: { status: original.status },
      after: { status: 'CANCELLED' },
      run: (tx) =>
        tx.memberInvitation.update({
          where: { id: original.id },
          data: { status: 'CANCELLED', revokedAt: new Date() },
        }),
    });
  } catch (error) {
    console.error('resendInvitation could not cancel the original', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  const created = await createInvitation({
    recipientName: original.recipientName ?? undefined,
    email: original.email,
    recipientTypeId: original.recipientTypeId!,
  });

  if (!created.ok) return created;
  return { ok: true, link: created.link, emailed: created.emailed };
}

/** Withdraw an invitation that has not been accepted. Takes effect at once. */
export async function cancelInvitation(input: {
  invitationId: string;
}): Promise<InvitationResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const invitation = await readAs(actor, (tx) =>
    tx.memberInvitation.findUnique({
      where: { id: input.invitationId },
      select: { id: true, email: true, status: true },
    }),
  );

  if (!invitation) return { ok: false, error: 'NOT_FOUND' };
  if (invitation.status === 'ACCEPTED' || invitation.status === 'COMPLETED') {
    return { ok: false, error: 'ALREADY_ACCEPTED' };
  }

  try {
    await performAudited({
      actor,
      action: 'invitation.cancel',
      entityType: 'MemberInvitation',
      entityId: invitation.id,
      summary: `Invitation to ${invitation.email} cancelled`,
      before: { status: invitation.status },
      after: { status: 'CANCELLED' },
      run: (tx) =>
        tx.memberInvitation.update({
          where: { id: invitation.id },
          data: { status: 'CANCELLED', revokedAt: new Date() },
        }),
    });
  } catch (error) {
    console.error('cancelInvitation failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true };
}

/** Whether real email can leave, for the admin UI to state plainly. */
export async function getEmailStatus(): Promise<{ configured: boolean; provider: string }> {
  return {
    configured: emailIsConfigured(),
    provider: emailServiceFromEnv().name,
  };
}
