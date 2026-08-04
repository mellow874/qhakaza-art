import { z } from 'zod';

export const ART_STATUSES = ['DRAFT', 'LISTED', 'SOLD', 'HIDDEN'] as const;
export type ArtStatus = (typeof ART_STATUSES)[number];

export const CURRENCIES = ['ZAR', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Uploaded artwork must be served over https — blocks `javascript:` and friends. */
const imageUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Image URLs must be absolute and served over https');

const priceSchema = z.coerce
  .number({ error: 'Price is required' })
  .positive('Price must be greater than zero')
  .max(100_000_000, 'Price is implausibly high')
  .refine(
    (value) => Number.isInteger(Number((value * 100).toFixed(2))),
    'Price supports at most two decimal places',
  );

const artPieceFields = {
  title: z.string().trim().min(1, 'Title is required').max(160),
  description: z.string().trim().min(1, 'Description is required').max(5_000),
  images: z
    .array(imageUrlSchema)
    .min(1, 'At least one image is required')
    .max(10, 'A piece can have at most 10 images'),
  medium: z.string().trim().min(1, 'Medium is required').max(120),
  dimensions: z.string().trim().min(1, 'Dimensions are required').max(120),
  price: priceSchema,
  currency: z.enum(CURRENCIES).default('ZAR'),
};

/**
 * Everything a piece needs before it can be shown to collectors.
 * A DRAFT cannot be promoted to LISTED unless it satisfies this.
 */
export const artPieceListedSchema = z.object(artPieceFields);

/** A work-in-progress piece: a title is enough to save it. */
export const artPieceDraftSchema = z
  .object(artPieceFields)
  .partial()
  .extend({ title: artPieceFields.title });

export function artPieceSchemaForStatus(status: ArtStatus) {
  return status === 'LISTED' || status === 'SOLD' ? artPieceListedSchema : artPieceDraftSchema;
}

export type ArtPieceListedInput = z.infer<typeof artPieceListedSchema>;
export type ArtPieceDraftInput = z.infer<typeof artPieceDraftSchema>;
