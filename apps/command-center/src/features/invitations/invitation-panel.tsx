'use client';

import { useState } from 'react';

import { invitationInputSchema } from '@/lib/validation/invitation';

import { cancelInvitation, createInvitation, resendInvitation } from './actions';

/**
 * Sending and tracking invitations.
 *
 * Two things this screen is careful about:
 *
 *  1. IT NEVER PRETENDS EMAIL WORKS. Until a provider is connected the send is
 *     written to the server log, so the panel says so and shows the link for
 *     the operator to send by hand. A UI that reported "sent" while nothing
 *     left the building would be the worst possible failure here.
 *
 *  2. THE LINK IS SHOWN ONCE. Only its digest is stored, so it cannot be
 *     retrieved later. The panel keeps it on screen until dismissed and says
 *     plainly that it will not be shown again.
 */

type RecipientType = { id: string; slug: string; label: string };

type Invitation = {
  id: string;
  email: string;
  recipientName: string | null;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
  openedAt: Date | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date;
  recipientType: { slug: string; label: string } | null;
};

/** How each status reads to an operator, and how urgent it looks. */
const STATUS: Record<string, { label: string; tone: 'live' | 'done' | 'waiting' | 'closed' }> = {
  CREATED: { label: 'Not sent', tone: 'waiting' },
  ISSUED: { label: 'Not sent', tone: 'waiting' },
  SENT: { label: 'Sent', tone: 'live' },
  OPENED: { label: 'Opened', tone: 'live' },
  ACCEPTED: { label: 'Accepted', tone: 'done' },
  COMPLETED: { label: 'Onboarded', tone: 'done' },
  EXPIRED: { label: 'Expired', tone: 'closed' },
  CANCELLED: { label: 'Cancelled', tone: 'closed' },
  REVOKED: { label: 'Cancelled', tone: 'closed' },
};

const TONE: Record<string, string> = {
  live: 'border-accent text-accent',
  done: 'border-line-strong text-heading',
  waiting: 'border-line-strong text-muted',
  closed: 'border-line text-muted',
};

function when(value: Date | null): string {
  return value ? new Date(value).toLocaleDateString('en-ZA') : '—';
}

export function InvitationPanel({
  invitations,
  recipientTypes,
  emailConfigured,
}: {
  invitations: Invitation[];
  recipientTypes: RecipientType[];
  emailConfigured: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [typeId, setTypeId] = useState(recipientTypes[0]?.id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ link: string; emailed: boolean } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setFormError(null);
    const parsed = invitationInputSchema.safeParse({
      recipientName: name,
      email,
      recipientTypeId: typeId,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join('.')] ??= issue.message;
      setErrors(next);
      return;
    }

    setErrors({});
    setBusy(true);

    try {
      const result = await createInvitation(parsed.data);

      if (result.ok) {
        setIssued({ link: result.link, emailed: result.emailed });
        setName('');
        setEmail('');
      } else if (result.error === 'ALREADY_INVITED') {
        setFormError('That address already has an open invitation of this type.');
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        setFormError('The invitation could not be created. Please try again.');
      }
    } catch {
      setFormError('The invitation could not be created. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {!emailConfigured && (
        <p className="border-line-strong bg-surface/50 text-muted border p-4 text-sm leading-relaxed">
          <strong className="text-heading">Email is not connected.</strong> Invitations are
          recorded and their links work, but nothing is delivered automatically — copy the link
          below and send it yourself. Connecting a provider is a configuration change; no
          invitation created now will need redoing.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="caps text-muted">Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Optional"
              className="border-line bg-canvas border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="caps text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border-line bg-canvas border px-3 py-2"
            />
            {errors.email && <span className="text-danger text-xs">{errors.email}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="caps text-muted">Invite as</span>
            <select
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
              className="border-line bg-canvas border px-3 py-2"
            >
              {recipientTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {formError && (
          <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-3 text-sm">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || recipientTypes.length === 0}
          className="border-accent text-accent caps hover:bg-accent/10 self-start border px-5 py-2 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create invitation'}
        </button>
      </form>

      {issued && (
        <div role="status" className="border-accent bg-accent/5 flex flex-col gap-3 border p-5">
          <p className="text-heading text-sm">
            Invitation created{issued.emailed && emailConfigured ? ' and emailed' : ''}.
          </p>
          <p className="text-muted text-xs leading-relaxed">
            This link is shown once. Only a fingerprint of it is stored, so it cannot be shown
            again — if it is lost, issue a new invitation.
          </p>
          <code className="bg-canvas border-line overflow-x-auto border p-3 text-xs break-all">
            {issued.link}
          </code>
          <button
            type="button"
            onClick={() => setIssued(null)}
            className="text-muted hover:text-heading caps self-start text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        {invitations.length === 0 ? (
          <p className="text-muted border-line border border-dashed p-8 text-center text-sm">
            No invitations yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-line-strong border-b text-left">
                {['Recipient', 'Type', 'Status', 'Created', 'Opened', 'Accepted', ''].map((h) => (
                  <th key={h} className="caps text-muted py-2 pr-4 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => {
                const status = STATUS[invitation.status] ?? {
                  label: invitation.status,
                  tone: 'waiting' as const,
                };
                const settled =
                  invitation.status === 'ACCEPTED' || invitation.status === 'COMPLETED';

                return (
                  <tr key={invitation.id} className="border-line/70 border-b">
                    <td className="py-3 pr-4">
                      <span className="text-heading block">
                        {invitation.recipientName ?? invitation.email}
                      </span>
                      {invitation.recipientName && (
                        <span className="text-muted text-xs">{invitation.email}</span>
                      )}
                    </td>
                    <td className="text-muted py-3 pr-4">
                      {invitation.recipientType?.label ?? '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`caps border px-2 py-1 ${TONE[status.tone]}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="text-muted py-3 pr-4">{when(invitation.createdAt)}</td>
                    <td className="text-muted py-3 pr-4">{when(invitation.openedAt)}</td>
                    <td className="text-muted py-3 pr-4">{when(invitation.acceptedAt)}</td>
                    <td className="py-3">
                      {/* An accepted invitation has done its job; reissuing it
                          would hand out a second route to an existing account. */}
                      {!settled && (
                        <span className="flex gap-3">
                          <ReissueButton id={invitation.id} onLink={setIssued} />
                          <CancelButton id={invitation.id} />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ReissueButton({
  id,
  onLink,
}: {
  id: string;
  onLink: (value: { link: string; emailed: boolean }) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      // Says "Reissue", not "Resend", because that is what it does: the original
      // link cannot be reproduced, so this cancels it and creates a new one.
      // Naming it "Resend" would misdescribe the effect on any link already sent.
      title="Cancels the current link and issues a new one. The original stops working."
      onClick={async () => {
        if (!confirm('Cancel the current link and issue a new one?')) return;
        setBusy(true);
        try {
          const result = await resendInvitation({ invitationId: id });
          if (result.ok) onLink({ link: result.link, emailed: result.emailed });
        } finally {
          setBusy(false);
        }
      }}
      className="text-accent caps text-xs hover:underline disabled:opacity-50"
    >
      {busy ? '…' : 'Reissue'}
    </button>
  );
}

function CancelButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm('Cancel this invitation? The link stops working immediately.')) return;
        setBusy(true);
        try {
          await cancelInvitation({ invitationId: id });
        } finally {
          setBusy(false);
        }
      }}
      className="text-muted hover:text-danger caps text-xs disabled:opacity-50"
    >
      {busy ? '…' : 'Cancel'}
    </button>
  );
}
