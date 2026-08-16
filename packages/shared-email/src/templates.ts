import type { EmailMessage } from './service';

/**
 * The messages the platform sends.
 *
 * Plain text, deliberately. An invitation to a private collective should read
 * like a note from a person, not a marketing template — and text arrives intact
 * everywhere, which an HTML mail does not.
 *
 * The copy is the concierge register the rest of the platform uses: measured,
 * unhurried, no exclamation marks and no urgency language.
 */

export type InvitationEmailInput = {
  recipientName: string | null;
  recipientTypeLabel: string;
  /** The full URL, already assembled. This module never builds URLs. */
  link: string;
  expiresAt: Date;
};

function greeting(name: string | null): string {
  return name?.trim() ? `Dear ${name.trim()},` : 'Hello,';
}

function expiryLine(expiresAt: Date): string {
  const formatted = expiresAt.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `This invitation is valid until ${formatted}.`;
}

/** An artist invited to join the collective. */
export function artistInvitationEmail(input: InvitationEmailInput): Omit<EmailMessage, 'to'> {
  return {
    subject: 'Your invitation to Qhakaza Art Collective',
    text: [
      greeting(input.recipientName),
      '',
      'You have been invited to join Qhakaza Art Collective as a represented artist.',
      '',
      'The link below opens your account setup. You will be asked for your name as',
      'it should appear, and a short statement about your practice. Work you submit',
      'is reviewed by Qhakaza before it is shown to collectors.',
      '',
      input.link,
      '',
      expiryLine(input.expiresAt),
      '',
      'If you were not expecting this, you can ignore it and nothing will happen.',
      '',
      'Qhakaza Art Collective',
    ].join('\n'),
  };
}

/** A collector whose application has been accepted. */
export function collectorInvitationEmail(input: InvitationEmailInput): Omit<EmailMessage, 'to'> {
  return {
    subject: 'Your invitation to Qhakaza Art Collective',
    text: [
      greeting(input.recipientName),
      '',
      'Your application has been considered and we would be glad to welcome you.',
      '',
      'The link below opens your private area, where you will find the work',
      'currently available to members and a direct route to your advisor.',
      '',
      input.link,
      '',
      expiryLine(input.expiresAt),
      '',
      'The link is personal to you. Please do not forward it.',
      '',
      'Qhakaza Art Collective',
    ].join('\n'),
  };
}

/**
 * Choose by recipient type.
 *
 * Falls back to the collector wording for a type added to the database later
 * that has no template yet — a generic but correct email beats a crash, and the
 * missing template shows up in review rather than in production.
 */
export function invitationEmail(
  typeSlug: string,
  input: InvitationEmailInput,
): Omit<EmailMessage, 'to'> {
  return typeSlug.toUpperCase() === 'ARTIST'
    ? artistInvitationEmail(input)
    : collectorInvitationEmail(input);
}
