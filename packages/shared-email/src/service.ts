/**
 * Sending email, without committing to who sends it.
 *
 * The handover brief requires a provider-agnostic layer and, critically, that
 * nothing is blocked while the provider is still being decided. So the default
 * implementation writes the message to the server log and reports success. The
 * invitation flow works end to end today; connecting Resend later changes one
 * environment variable and no application code.
 *
 * The sending address is desk@qhakazaartcollective.co.za. Before real mail can
 * leave, three DNS records (SPF, DKIM, return-path) must exist on that domain,
 * or everything Qhakaza sends will be filed as spam. That is an open item on
 * the founder, not a development task.
 */

export type EmailAddress = string;

export type EmailMessage = {
  to: EmailAddress;
  subject: string;
  /** Plain text is required; HTML is optional. A text-only mail still works. */
  text: string;
  html?: string;
  replyTo?: EmailAddress;
};

export type SendResult =
  | { ok: true; provider: string; id?: string }
  | { ok: false; provider: string; error: string };

export interface EmailService {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

/** The address every Qhakaza email is sent from. */
export const DEFAULT_FROM = 'Qhakaza Art Collective <desk@qhakazaartcollective.co.za>';

/**
 * The default, and deliberately not a silent no-op.
 *
 * It records the whole message so an operator can see exactly what would have
 * gone out, and reports success so the calling workflow proceeds. The
 * invitation UI shows the link alongside, so a real invitation can still be
 * delivered by hand today.
 */
export class LoggingEmailService implements EmailService {
  readonly name = 'logging';

  constructor(private readonly from: string = DEFAULT_FROM) {}

  async send(message: EmailMessage): Promise<SendResult> {
    console.info(
      [
        '',
        '--- EMAIL (not sent: no provider configured) ---',
        `from:    ${this.from}`,
        `to:      ${message.to}`,
        `subject: ${message.subject}`,
        '',
        message.text,
        '--- end ---',
        '',
      ].join('\n'),
    );

    return { ok: true, provider: this.name };
  }
}

/**
 * Resend, over its HTTP API.
 *
 * Deliberately `fetch` rather than the `resend` package: one less dependency,
 * and it keeps the provider genuinely swappable. If Postmark or SES is chosen
 * instead, this is the only file that changes.
 */
export class ResendEmailService implements EmailService {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string = DEFAULT_FROM,
  ) {}

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      });

      if (!response.ok) {
        // The body carries the reason (unverified domain, bad key). Read it:
        // "send failed" alone is not enough to act on.
        const detail = await response.text().catch(() => '');
        return {
          ok: false,
          provider: this.name,
          error: `Resend returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
        };
      }

      const body = (await response.json().catch(() => ({}))) as { id?: string };
      return { ok: true, provider: this.name, id: body.id };
    } catch (error) {
      // A network failure must not take down the action that asked for the
      // email. The caller decides what a failed send means.
      return {
        ok: false,
        provider: this.name,
        error: error instanceof Error ? error.message : 'Unknown transport error',
      };
    }
  }
}

/**
 * Pick an implementation from configuration.
 *
 * Falls back to logging rather than throwing. A missing API key must not take
 * the platform down — it means email is not connected yet, which is the
 * expected state, and the invitation link is still available in the admin UI.
 */
export function emailServiceFromEnv(env: NodeJS.ProcessEnv = process.env): EmailService {
  const from = env.EMAIL_FROM?.trim() || DEFAULT_FROM;
  const provider = (env.EMAIL_PROVIDER?.trim() || 'logging').toLowerCase();

  if (provider === 'resend') {
    const key = env.RESEND_API_KEY?.trim();
    if (key) return new ResendEmailService(key, from);

    console.warn(
      'EMAIL_PROVIDER=resend but RESEND_API_KEY is not set. ' +
        'Falling back to logging; invitations will not be delivered by email.',
    );
  }

  return new LoggingEmailService(from);
}

/** True when real mail can actually leave. The admin UI says so plainly. */
export function emailIsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    (env.EMAIL_PROVIDER?.trim() || 'logging').toLowerCase() === 'resend' &&
    Boolean(env.RESEND_API_KEY?.trim())
  );
}
