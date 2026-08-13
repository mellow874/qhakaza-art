import { z } from 'zod';

import { privateNote } from '@/content/private-note';

/**
 * The Private Note survey.
 *
 * Only a name and an email are required. Everything else is optional by
 * design — this is a note, not an application, and a prospective collector who
 * answers three questions has still told us something worth having.
 */

const values = <T extends { value: string }>(options: readonly T[]) =>
  options.map((option) => option.value);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional();

/** A closed set, but empty is always allowed — every choice here is optional. */
const optionalChoice = (allowed: readonly string[]) =>
  z
    .string()
    .transform((value) => (value === '' ? undefined : value))
    .optional()
    .refine((value) => value === undefined || allowed.includes(value), 'Choose one of the options');

export const privateNoteSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.email('Enter a valid email address')),

  // Re-checked server-side against the published lists: these are chips and
  // checkboxes in the browser, and nothing stops a crafted request.
  mediums: z
    .array(z.enum(privateNote.mediums))
    .default([])
    .transform((v) => [...new Set(v)]),
  regions: z
    .array(z.enum(privateNote.regions))
    .default([])
    .transform((v) => [...new Set(v)]),
  subjects: optionalText(2_000),

  acquisitionPace: optionalChoice(values(privateNote.acquisitionPaces)),
  budgetBand: optionalChoice(values(privateNote.budgetBands)),
  advisoryStyle: optionalChoice(values(privateNote.advisoryStyles)),
  contactStyle: optionalChoice(values(privateNote.contactStyles)),

  building: optionalText(2_000),
  frustrations: optionalText(2_000),
  goodOutcome: optionalText(2_000),

  mayContact: z.boolean().default(false),
});

export type PrivateNoteInput = z.infer<typeof privateNoteSchema>;
