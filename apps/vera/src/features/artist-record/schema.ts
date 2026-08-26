import { z } from 'zod';

/**
 * What an artist may write into their own record.
 *
 * ONE SCHEMA PER SECTION, not one for the whole record. The record is captured
 * progressively - an artist fills in what they have, leaves the rest, and comes
 * back - so a single schema demanding the whole thing would make partial
 * progress unsavable, which is the same as not having sections at all.
 *
 * NOTHING HERE ACCEPTS A VERIFICATION STATE. An artist saying a thing is what
 * `ARTIST_DECLARED` means; they cannot also declare it verified. The server
 * sets `verification` and `assertedVia`, and parsing against these schemas is
 * what strips the field if it is ever sent.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

/** A year an artist would actually type. Rejects 20260 and 198. */
const year = z
  .number()
  .int()
  .min(1900, 'Use a four-digit year from 1900 onwards')
  .max(new Date().getFullYear() + 1, 'That year is in the future');

// ---------------------------------------------------------------------------

/**
 * The two biographies.
 *
 * Qhakaza confirmed the artist maintains BOTH: a public one for their page and
 * a fuller internal one for assessment. They are separate fields rather than
 * one field and a checkbox, because the two are written differently - the
 * public one is for a reader, the internal one is for someone deciding.
 */
export const aboutSchema = z.object({
  biographyPublic: optionalText(4_000),
  biographyInternal: optionalText(8_000),
  practice: optionalText(4_000),
  statement: optionalText(2_000),
  basedIn: optionalText(120),
  nationality: optionalText(120),
  birthYear: year.optional(),
});

export const mediumsSchema = z.object({
  /// Ids from the configurable Medium list, never free text: a medium typed by
  /// hand cannot be matched against a collector's stated interest.
  mediumIds: z.array(z.string().min(1)).max(20),
  primaryMediumIds: z.array(z.string().min(1)).max(5),
});

export const exhibitionSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'An exhibition needs a title').max(300),
  venue: optionalText(300),
  typeId: optionalText(60),
  startYear: year.optional(),
  endYear: year.optional(),
  role: optionalText(200),
  curator: optionalText(200),
  reference: optionalText(500),
});

export const representationSchema = z.object({
  id: z.string().optional(),
  /// The gallery's name. Resolved to a Party by the server, which reuses an
  /// existing row where one matches rather than creating a duplicate.
  partyName: z.string().trim().min(1, 'Name the gallery or agent').max(300),
  typeId: optionalText(60),
  territory: optionalText(200),
  startYear: year.optional(),
  endYear: year.optional(),
  current: z.boolean().default(true),
  exclusive: z.boolean().optional(),
  note: optionalText(1_000),
});

export const cvEntrySchema = z.object({
  id: z.string().optional(),
  typeId: optionalText(60),
  title: z.string().trim().min(1, 'This line needs a title').max(300),
  organisation: optionalText(300),
  location: optionalText(200),
  startYear: year.optional(),
  endYear: year.optional(),
  detail: optionalText(1_000),
});

export const signalSchema = z.object({
  id: z.string().optional(),
  signalTypeId: optionalText(60),
  institution: optionalText(300),
  description: z.string().trim().min(1, 'Describe the recognition').max(1_000),
  year: year.optional(),
});

export const linkSchema = z.object({
  id: z.string().optional(),
  kind: z.string().trim().min(1, 'Say what this link is').max(60),
  label: optionalText(120),
  url: z.url('Links must be full web addresses, starting with https://').max(2_000),
});

/** Withdrawing a claim. Not a delete - see `removedAt` on the tables. */
export const withdrawSchema = z.object({
  id: z.string().min(1),
  reason: optionalText(500),
});

export type AboutInput = z.infer<typeof aboutSchema>;
export type MediumsInput = z.infer<typeof mediumsSchema>;
export type ExhibitionInput = z.infer<typeof exhibitionSchema>;
export type RepresentationInput = z.infer<typeof representationSchema>;
export type CvEntryInput = z.infer<typeof cvEntrySchema>;
export type SignalInput = z.infer<typeof signalSchema>;
export type LinkInput = z.infer<typeof linkSchema>;
