/**
 * Copy for the Collector Appreciation Periods feature.
 *
 * LANGUAGE DECISION. Qhakaza to confirm:
 *
 *   "Appreciation period"  — not loan, rental or return
 *   "Placed with"          — not shipped, sent, or loaned
 *   "Concluded"            — not returned or expired
 *   "Extended"             — not renewed or rolled over
 *
 * The register is the same concierge tone the rest of the platform uses:
 * measured, unhurried, no exclamation marks and no urgency language.
 */

// ---------------------------------------------------------------------------
// Collector-facing copy
// ---------------------------------------------------------------------------

export const collector = {
  /** The page heading. */
  heading: 'Your Appreciation Periods',

  /** Introduction below the heading. */
  intro:
    'Works placed with you by Qhakaza are yours to live with for a defined ' +
    'period. This is a quiet time to spend with the work — no deadline, no ' +
    'expectation, simply the space to appreciate it on your own terms.',

  /** When there are active periods. */
  activePeriodsTitle: 'Currently with you',

  /** When there are no active periods. */
  emptyState: {
    title: 'No appreciation periods active',
    body: 'When Qhakaza places a work with you, it will appear here with the time remaining shown calmly.',
  },

  /** When the period has concluded. */
  concluded: 'This appreciation period has concluded',

  /** The time remaining, shown as days. */
  timeRemaining: (days: number): string => {
    if (days === 0) return 'Final day';
    if (days === 1) return '1 day remaining';
    return `${days} days remaining`;
  },

  /** The progress, shown as a gentle percentage. */
  progressNote: (percentage: number): string => {
    if (percentage < 25) return 'Early days — enjoy the work';
    if (percentage < 50) return ' settling in';
    if (percentage < 75) return ' well into the period';
    return ' approaching the final stretch';
  },

  /** Past periods. */
  historyTitle: 'Appreciation History',
  historyIntro:
    'A record of works previously placed with you. This is part of your collecting story.',

  /** The work details shown alongside each period. */
  workBy: (artistName: string) => `by ${artistName}`,
  periodFrom: (start: Date, end: Date) =>
    `${start.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} — ${end.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`,
};

// ---------------------------------------------------------------------------
// Admin-facing copy
// ---------------------------------------------------------------------------

export const admin = {
  /** Dashboard heading. */
  heading: 'Appreciation Periods',

  /** Subtitle. */
  subtitle: 'Active and recent appreciation periods at a glance',

  /** When creating a new period. */
  createTitle: 'Place a work with a collector',
  createDescription:
    'Set the appreciation period. The collector will see the time remaining ' +
    'presented calmly, as an appreciation period rather than a deadline.',

  /** Duration field. */
  durationLabel: 'Appreciation period (days)',
  durationHint: 'How many days the collector has to live with the work. No fixed term — set per case.',

  /** Reminder interval. */
  reminderLabel: 'Reminder interval (days)',
  reminderHint: 'How often to remind the collector and administrator before conclusion. Leave empty for no reminders.',

  /** Notes. */
  notesLabel: 'Internal notes',
  notesHint: 'Context about this placement. Visible to staff only.',

  /** Table columns. */
  table: {
    work: 'Work',
    collector: 'Collector',
    period: 'Appreciation Period',
    timeRemaining: 'Time Remaining',
    status: 'Status',
    actions: 'Actions',
  },

  /** Actions. */
  extendLabel: 'Extend',
  concludeLabel: 'Conclude Early',
  extendDescription: 'Add days to this appreciation period. The collector will see the updated time.',
  concludeDescription: 'End the appreciation period now. The record is retained permanently.',

  /** Status badges. */
  statusBadge: {
    ACTIVE: 'Active',
    EXTENDED: 'Extended',
    CONCLUDED: 'Concluded',
  },

  /** Empty state. */
  emptyState: {
    title: 'No active appreciation periods',
    body: 'When a work is placed with a collector, it will appear here.',
  },

  /** Past custodies section on artwork detail. */
  provenanceTitle: 'Appreciation History',
  provenanceIntro:
    'A permanent record of every collector who has lived with this work. ' +
    'This is provenance information.',

  /** Dual custody prevention message. */
  dualCustodyError:
    'This work is currently in an active appreciation period with another collector. ' +
    'Conclude the existing period before placing it with someone else.',

  /** Time remaining formatting. */
  timeRemaining: (days: number): string => {
    if (days === 0) return 'Final day';
    if (days === 1) return '1 day';
    return `${days} days`;
  },
};
