import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@qhakaza/shared-auth/server';
import { buttonStyles } from '@qhakaza/shared-ui';
import {
  acceptInvitation,
  findInvitationByToken,
  markInvitationOpened,
  prisma,
} from '@qhakaza/shared-db';

export const metadata: Metadata = {
  title: 'Your invitation',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

/**
 * Where an artist invitation lands.
 *
 * This route was MISSING. Phase 2 built artist invitations and pointed their
 * links at /invitation/<token>, but nothing was ever built to receive them, so
 * every artist invitation would have 404'd. Found while fixing a link the
 * founder could not open.
 *
 * The flow, in the order it has to happen:
 *
 *   1. the token is looked up and the open is recorded, whoever is asking
 *   2. an invalid, expired or cancelled token says so plainly and stops
 *   3. a visitor with no account is sent to sign up and returned here
 *   4. a signed-in artist consumes the invitation, once, and goes to onboarding
 *
 * Recording the open BEFORE checking the session is deliberate: the recipient
 * clicked, and that is worth knowing even if they never finish.
 */
export default async function InvitationPage({ params }: Props) {
  const { token } = await params;

  const invitation = await findInvitationByToken(token);

  if (!invitation) return <Refusal reason="not-found" />;

  await markInvitationOpened(invitation.id);

  // Both decided by the lookup rather than here: a page computing expiry would
  // be calling Date.now() during render, and two screens could disagree about
  // the same invitation.
  if (invitation.isCancelled) return <Refusal reason="cancelled" />;
  if (invitation.isExpired) return <Refusal reason="expired" />;

  const session = await auth();
  const userId = session?.user?.id;

  // No account yet. Send them to sign up and bring them back here, with the
  // address the invitation was issued to already filled in.
  if (!userId) {
    const callback = encodeURIComponent(`/invitation/${token}`);
    return (
      <Welcome
        name={invitation.recipientName}
        email={invitation.email}
        href={`/signup?callbackUrl=${callback}&email=${encodeURIComponent(invitation.email)}`}
      />
    );
  }

  const result = await acceptInvitation(invitation.id, userId);

  if (!result.ok) {
    return <Refusal reason={result.reason === 'TAKEN_BY_ANOTHER_ACCOUNT' ? 'taken' : 'expired'} />;
  }

  // Accepted. Where they go next depends on whether they have a profile yet.
  const artist = await prisma.artist.findUnique({ where: { userId }, select: { id: true } });
  redirect(artist ? '/artist/dashboard' : '/artist/onboarding');
}

function Welcome({
  name,
  email,
  href,
}: {
  name: string | null;
  email: string;
  href: string;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <p className="eyebrow">Your invitation</p>
      <h1 className="text-4xl leading-[1.15] sm:text-5xl">
        {name ? `Welcome, ${name}` : 'Welcome to Qhakaza'}
      </h1>
      <p className="text-body leading-relaxed">
        You have been invited to join Qhakaza Art Collective as a represented artist. Create your
        account to continue — you will be asked for your name as it should appear and a short
        statement about your practice.
      </p>
      <p className="text-muted text-sm">
        This invitation was sent to <strong className="text-heading">{email}</strong>.
      </p>
      <Link href={href} className={buttonStyles({ size: 'lg', className: 'self-start' })}>
        Create your account
      </Link>
    </main>
  );
}

/**
 * Why a link did not work.
 *
 * Each case is named rather than collapsed into "invalid link", because the
 * right next step differs: an expired invitation can be reissued, a link
 * already used by someone else cannot.
 */
function Refusal({ reason }: { reason: 'not-found' | 'expired' | 'cancelled' | 'taken' }) {
  const copy = {
    'not-found': {
      title: 'This link is not recognised',
      body: 'Check that you copied the whole link, including the part before the first slash. If it still does not work, ask Qhakaza to send a new one.',
    },
    expired: {
      title: 'This invitation has expired',
      body: 'Invitations are valid for 14 days. Ask Qhakaza to issue a new one and it will work straight away.',
    },
    cancelled: {
      title: 'This invitation has been withdrawn',
      body: 'It is no longer valid. If you think that is a mistake, get in touch.',
    },
    taken: {
      title: 'This invitation has already been used',
      body: 'It was accepted by a different account. If that was not you, get in touch before signing in.',
    },
  }[reason];

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <p className="eyebrow">Invitation</p>
      <h1 className="text-4xl leading-[1.15] sm:text-5xl">{copy.title}</h1>
      <p className="text-body leading-relaxed">{copy.body}</p>
      <div className="mt-2 flex flex-wrap gap-4">
        <Link href="/contact" className={buttonStyles({ size: 'md' })}>
          Contact Qhakaza
        </Link>
        <Link href="/" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
          Back to the home page
        </Link>
      </div>
    </main>
  );
}
