import { z } from 'zod';

import { apply } from '@/content/collectors';

/**
 * The collector intake.
 *
 * Only name and email are required — the design marks exactly those two with an
 * asterisk. Everything else, including both financial bands, is optional, which
 * matters: this form asks about someone's income and liquid assets before they
 * have any relationship with the business, and refusing to answer must not stop
 * the application.
 */

const INCOME_BANDS = apply.financial.incomeBands.map((band) => band.value);
const ASSET_BANDS = apply.financial.assetBands.map((band) => band.value);
const MEDIUMS = apply.collecting.mediums;

/** Blank optional inputs arrive as '' from an uncontrolled field, not undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional();

/** A closed set, but empty is always allowed — the field is optional. */
const optionalChoice = (values: readonly string[]) =>
  z
    .string()
    .transform((value) => (value === '' ? undefined : value))
    .optional()
    .refine((value) => value === undefined || values.includes(value), 'Choose one of the options');

export const collectorApplicationSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.email('Enter a valid email address')),
  phone: optionalText(40),
  country: optionalText(80),
  city: optionalText(80),

  annualIncomeBand: optionalChoice(INCOME_BANDS),
  liquidAssetsBand: optionalChoice(ASSET_BANDS),

  collectingGoal: optionalText(2_000),
  artExposure: optionalText(2_000),
  // Re-checked server-side against the published list: the chips are client
  // state, and nothing stops a crafted request sending arbitrary strings.
  preferredMediums: z
    .array(z.enum(MEDIUMS))
    .max(MEDIUMS.length)
    .default([])
    .transform((values) => [...new Set(values)]),
});

export type CollectorApplicationInput = z.infer<typeof collectorApplicationSchema>;
