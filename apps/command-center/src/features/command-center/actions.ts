'use server';

import { randomBytes } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { fingerprintToken } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';
import { prisma } from '@qhakaza/shared-db';

import { commandCentreActor, isFailure, performAudited, type AdminFailure } from '@/lib/audit';

/**
 * Command Center actions — the only bridge between the two sites.
 *
 * Every one of these is authorised and audited by `performAudited`, which
 * writes the change and its AuditLog row in a single transaction. None of them
 * can succeed unaudited.
 */

export type AdminResult<T = undefined> =
  ({ ok: true } & (T extends undefined ? object : T)) | AdminFailure;

const INVITATION_DAYS = 14;

/** Vetting: an artist becomes visible to the public and to members. */
export async function setArtistApproval(input: {
  artistId: string;
  approved: boolean;
}): Promise<AdminResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return actor;

  const artist = await prisma.artist.findUnique({
    where: { id: input.artistId },
    select: { id: true, displayName: true, approved: true },
  });
  if (!artist) return { ok: false, error: 'NOT_FOUND' };

  try {
    await performAudited({
      actor,
      action: input.approved ? 'artist.approve' : 'artist.unapprove',
      entityType: 'Artist',
      entityId: artist.id,
      summary: `${artist.displayName} ${input.approved ? 'approved' : 'approval withdrawn'}`,
      before: { approved: artist.approved },
      after: { approved: input.approved },
      run: (tx) =>
        tx.artist.update({ where: { id: artist.id }, data: { approved: input.approved } }),
    });

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('setArtistApproval failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/**
 * Release a work to members.
 *
 * Under the current decision — one shared pool, no per-member curation — this
 * IS the release mechanism: an approved artist's work moving to LISTED is what
 * makes it visible in the Collector Platform. When a Match/CuratedRoute entity
 * exists, this is where per-member routing would attach.
 */
export async function setArtworkRelease(input: {
  artworkId: string;
  release: boolean;
}): Promise<AdminResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return actor;

  const artwork = await prisma.artwork.findUnique({
    where: { id: input.artworkId },
    select: { id: true, title: true, status: true, artist: { select: { approved: true } } },
  });
  if (!artwork) return { ok: false, error: 'NOT_FOUND' };

  // Releasing work by an unvetted artist would put a raw submission in front of
  // members through the back door. The gate is here, not only in the query.
  if (input.release && !artwork.artist.approved) return { ok: false, error: 'INVALID' };

  const next = input.release ? 'LISTED' : 'HIDDEN';

  try {
    await performAudited({
      actor,
      action: input.release ? 'artwork.release' : 'artwork.withdraw',
      entityType: 'Artwork',
      entityId: artwork.id,
      summary: `${artwork.title} ${input.release ? 'released to members' : 'withdrawn'}`,
      before: { status: artwork.status },
      after: { status: next },
      run: (tx) => tx.artwork.update({ where: { id: artwork.id }, data: { status: next } }),
    });

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('setArtworkRelease failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/** Vetting a collector intake. Writes the CollectorVerification record. */
export async function decideCollectorIntake(input: {
  intakeId: string;
  outcome: 'VERIFIED' | 'REJECTED';
  notes?: string;
}): Promise<AdminResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return actor;

  const intake = await prisma.collectorIntake.findUnique({
    where: { id: input.intakeId },
    select: { id: true, fullName: true, status: true },
  });
  if (!intake) return { ok: false, error: 'NOT_FOUND' };

  const nextStatus = input.outcome === 'VERIFIED' ? 'ACCEPTED' : 'DECLINED';

  try {
    await performAudited({
      actor,
      action: 'intake.decide',
      entityType: 'CollectorIntake',
      entityId: intake.id,
      // The applicant's financial answers are deliberately NOT copied into the
      // audit trail. The decision is recorded; the disclosure stays in one place.
      summary: `Intake for ${intake.fullName} ${input.outcome.toLowerCase()}`,
      before: { status: intake.status },
      after: { status: nextStatus, outcome: input.outcome },
      run: async (tx) => {
        await tx.collectorIntake.update({
          where: { id: intake.id },
          data: { status: nextStatus },
        });

        await tx.collectorVerification.upsert({
          where: { intakeId: intake.id },
          create: {
            intakeId: intake.id,
            outcome: input.outcome,
            notes: input.notes ?? null,
            decidedAt: new Date(),
            decidedById: actor.userId,
            createdById: actor.userId,
          },
          update: {
            outcome: input.outcome,
            notes: input.notes ?? null,
            decidedAt: new Date(),
            decidedById: actor.userId,
          },
        });
      },
    });

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('decideCollectorIntake failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/**
 * Grant membership and issue the invitation that unlocks `/private/<token>`.
 *
 * The plaintext token is returned **once**, to be put in the invitation email.
 * Only its SHA-256 is stored, so it can never be read back out of the database
 * — not by an attacker with a dump, and not by us.
 */
export async function inviteCollector(input: {
  intakeId: string;
}): Promise<AdminResult<{ token: string }>> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return actor;

  const intake = await prisma.collectorIntake.findUnique({
    where: { id: input.intakeId },
    select: { id: true, email: true, fullName: true, verification: { select: { outcome: true } } },
  });
  if (!intake) return { ok: false, error: 'NOT_FOUND' };

  // Invitation follows verification. Inviting an unvetted applicant would make
  // the vetting step decorative.
  if (intake.verification?.outcome !== 'VERIFIED') return { ok: false, error: 'INVALID' };

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);

  try {
    await performAudited({
      actor,
      action: 'membership.invite',
      entityType: 'CollectorIntake',
      entityId: intake.id,
      summary: `Invitation issued to ${intake.fullName}`,
      after: { email: intake.email, expiresAt: expiresAt.toISOString() },
      run: async (tx) => {
        const membership = await tx.membership.upsert({
          where: { intakeId: intake.id },
          create: {
            intakeId: intake.id,
            status: 'PENDING',
            createdById: actor.userId,
          },
          update: {},
        });

        await tx.memberInvitation.create({
          data: {
            membershipId: membership.id,
            email: intake.email,
            // Never the token itself.
            tokenHash: fingerprintToken(token),
            expiresAt,
            createdById: actor.userId,
          },
        });
      },
    });

    revalidatePath('/');
    return { ok: true, token };
  } catch (error) {
    console.error('inviteCollector failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/** Pull an invitation. Takes effect immediately, mid-session. */
export async function revokeInvitation(input: { invitationId: string }): Promise<AdminResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return actor;

  const invitation = await prisma.memberInvitation.findUnique({
    where: { id: input.invitationId },
    select: { id: true, email: true, status: true },
  });
  if (!invitation) return { ok: false, error: 'NOT_FOUND' };

  try {
    await performAudited({
      actor,
      action: 'invitation.revoke',
      entityType: 'MemberInvitation',
      entityId: invitation.id,
      summary: `Invitation for ${invitation.email} revoked`,
      before: { status: invitation.status },
      after: { status: 'REVOKED' },
      run: (tx) =>
        tx.memberInvitation.update({
          where: { id: invitation.id },
          data: { status: 'REVOKED', revokedAt: new Date() },
        }),
    });

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('revokeInvitation failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/** Permissions. ADMIN only — an advisor cannot grant themselves more reach. */
export async function setUserRole(input: {
  userId: string;
  role: 'ARTIST' | 'COLLECTOR' | 'ADMIN' | 'ADVISOR';
}): Promise<AdminResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return actor;
  if (actor.role !== 'ADMIN') return { ok: false, error: 'FORBIDDEN' };

  // Removing your own admin rights locks the last administrator out of the
  // platform, and nothing here can put them back.
  if (input.userId === actor.userId && input.role !== 'ADMIN') {
    return { ok: false, error: 'INVALID' };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) return { ok: false, error: 'NOT_FOUND' };

  try {
    await performAudited({
      actor,
      action: 'user.role',
      entityType: 'User',
      entityId: user.id,
      summary: `${user.email}: ${user.role} to ${input.role}`,
      before: { role: user.role },
      after: { role: input.role },
      run: (tx) => tx.user.update({ where: { id: user.id }, data: { role: input.role } }),
    });

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('setUserRole failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/** Mark a member enquiry as picked up, so two advisors do not both answer it. */
export async function setNoteStatus(input: {
  noteId: string;
  status: 'IN_REVIEW' | 'ACTIONED' | 'ARCHIVED';
}): Promise<AdminResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return actor;

  const note = await prisma.privateNoteSubmission.findUnique({
    where: { id: input.noteId },
    select: { id: true, subject: true, status: true },
  });
  if (!note) return { ok: false, error: 'NOT_FOUND' };

  try {
    await performAudited({
      actor,
      action: 'note.status',
      entityType: 'PrivateNoteSubmission',
      entityId: note.id,
      // The note body is a member's private correspondence and is not copied
      // into the audit trail.
      summary: `Enquiry "${note.subject}" moved to ${input.status}`,
      before: { status: note.status },
      after: { status: input.status },
      run: (tx) =>
        tx.privateNoteSubmission.update({ where: { id: note.id }, data: { status: input.status } }),
    });

    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('setNoteStatus failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
