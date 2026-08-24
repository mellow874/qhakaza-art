/**
 * Custody Period Reminders
 *
 * Reminders are sent to both the collector and the administrator ahead of
 * conclusion, at intervals Qhakaza controls.
 *
 * THIS IS THE FOUNDATION. The actual email sending is wired to the shared
 * email service (LoggingEmailService today, Resend when configured). The
 * reminder logic determines WHAT to send and WHEN; the email layer sends it.
 *
 * Language: "appreciation period" — not loan, rental, or return.
 */

import { prisma } from './client';
import { withActor } from './actor';
import { emailServiceFromEnv } from '@qhakaza/shared-email';
import type { EmailMessage } from '@qhakaza/shared-email';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReminderWindow = {
  daysBeforeEnd: number;
  /** How many days before the end date this reminder fires. */
};

/**
 * The reminder windows. Qhakaza controls these intervals.
 *
 * By default: 7 days before, and 3 days before conclusion.
 * These can be overridden per custody via `reminderIntervalDays`.
 */
export const DEFAULT_REMINDER_WINDOWS: ReminderWindow[] = [
  { daysBeforeEnd: 7 },
  { daysBeforeEnd: 3 },
];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Find custody periods that need a reminder sent.
 *
 * A period needs a reminder when:
 *   - It is ACTIVE or EXTENDED
 *   - It has a reminderIntervalDays set (null means no reminders)
 *   - The current time is within a reminder window
 *   - No reminder has already been sent for this window
 *
 * The "no reminder already sent" check uses a convention: we look for
 * an AuditLog entry with action 'custody_reminder_sent' for this custody
 * period within the reminder window. This avoids a separate reminder table.
 */
export async function getCustodyPeriodsNeedingReminder(
  now: Date = new Date(),
) {
  // Find all active custody periods with reminders configured
  const periods = await prisma.custodyPeriod.findMany({
    where: {
      status: { in: ['ACTIVE', 'EXTENDED'] },
      reminderIntervalDays: { not: null },
    },
    include: {
      artwork: {
        select: {
          id: true,
          title: true,
          artist: { select: { displayName: true } },
        },
      },
      membership: {
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true } },
          intake: { select: { fullName: true } },
        },
      },
    },
  });

  const needsReminder: Array<{
    period: (typeof periods)[number];
    daysUntilEnd: number;
  }> = [];

  for (const period of periods) {
    const msUntilEnd = period.endsAt.getTime() - now.getTime();
    const daysUntilEnd = Math.ceil(msUntilEnd / (24 * 60 * 60 * 1000));

    // Check if we're within any reminder window
    const interval = period.reminderIntervalDays ?? 3;
    const windows = generateReminderWindows(interval);

    for (const window of windows) {
      if (daysUntilEnd <= window.daysBeforeEnd && daysUntilEnd > 0) {
        // Check if we already sent a reminder for this window
        const alreadySent = await prisma.auditLog.findFirst({
          where: {
            action: 'custody_reminder_sent',
            entityType: 'CustodyPeriod',
            entityId: period.id,
            summary: { contains: `${window.daysBeforeEnd}d` },
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // within last 24h
            },
          },
          select: { id: true },
        });

        if (!alreadySent) {
          needsReminder.push({ period, daysUntilEnd });
          break; // One reminder per period per cycle
        }
      }
    }
  }

  return needsReminder;
}

/**
 * Generate reminder windows from an interval.
 *
 * If interval is 3 days, reminders fire at 7 days, 3 days, and 1 day before.
 * If interval is 7 days, reminders fire at 14 days, 7 days, and 3 days before.
 */
function generateReminderWindows(intervalDays: number): ReminderWindow[] {
  return [
    { daysBeforeEnd: intervalDays * 2 },
    { daysBeforeEnd: intervalDays },
    { daysBeforeEnd: Math.min(3, intervalDays - 1) },
  ].filter((w) => w.daysBeforeEnd > 0);
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/**
 * Send reminders for custody periods that need them.
 *
 * Returns the number of reminders sent. Never throws — a failed email
 * must not prevent other reminders from going out.
 */
export async function sendCustodyReminders(
  now: Date = new Date(),
): Promise<number> {
  const needingReminder = await getCustodyPeriodsNeedingReminder(now);
  const emailService = emailServiceFromEnv();
  let sent = 0;

  for (const { period, daysUntilEnd } of needingReminder) {
    try {
      // Build the reminder emails
      const messages = buildReminderEmails(period, daysUntilEnd);

      for (const message of messages) {
        const result = await emailService.send(message);
        if (result.ok) sent++;
      }

      // Record that we sent the reminder
      await withActor({ role: 'system' }, (tx) =>
        tx.auditLog.createMany({
          data: [
            {
              action: 'custody_reminder_sent',
              entityType: 'CustodyPeriod',
              entityId: period.id,
              summary: `Reminder sent: ${daysUntilEnd}d before conclusion of appreciation period for "${period.artwork.title}"`,
              actorRole: 'ADMIN',
            },
          ],
        }),
      );
    } catch (error) {
      // Never let one failed email prevent others from going out
      console.error(
        `Failed to send custody reminder for period ${period.id}:`,
        error,
      );
    }
  }

  return sent;
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function buildReminderEmails(
  period: {
    id: string;
    endsAt: Date;
    artwork: { title: string; artist: { displayName: string } };
    membership: {
      user: { name: string | null; email: string } | null;
      intake: { fullName: string } | null;
    };
  },
  daysUntilEnd: number,
): EmailMessage[] {
  const messages: EmailMessage[] = [];
  const collectorName =
    period.membership.user?.name ??
    period.membership.intake?.fullName ??
    'there';

  const endDate = period.endsAt.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Reminder to the collector
  if (period.membership.user?.email) {
    messages.push({
      to: period.membership.user.email,
      subject: `Your appreciation period for "${period.artwork.title}"`,
      text: [
        `Dear ${collectorName},`,
        '',
        `Your appreciation period for "${period.artwork.title}" by ${period.artwork.artist.displayName} has ${daysUntilEnd} ${daysUntilEnd === 1 ? 'day' : 'days'} remaining.`,
        '',
        `The period concludes on ${endDate}.`,
        '',
        'If you have any questions, please speak to your advisor.',
        '',
        'Qhakaza Art Collective',
      ].join('\n'),
    });
  }

  // Reminder to the administrator (sent to desk@qhakazaartcollective.co.za)
  messages.push({
    to: 'desk@qhakazaartcollective.co.za',
    subject: `Custody reminder: "${period.artwork.title}" — ${daysUntilEnd} days remaining`,
    text: [
      'Appreciation period reminder:',
      '',
      `Work: "${period.artwork.title}" by ${period.artwork.artist.displayName}`,
      `Collector: ${collectorName}`,
      `Days remaining: ${daysUntilEnd}`,
      `Concludes: ${endDate}`,
      '',
      'Qhakaza Art Collective',
    ].join('\n'),
  });

  return messages;
}
