import { z } from 'zod';

/**
 * A member's private enquiry.
 *
 * Kept out of the server-action file on purpose: a `"use server"` module may
 * only export async functions, so exporting a schema from it breaks the build.
 * It also belongs here — the client form and the action both validate against
 * this one definition rather than keeping their own idea of what is valid.
 */
export const enquirySchema = z.object({
  token: z.string().min(1),
  artworkId: z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  subject: z.string().trim().min(1, 'A subject is required').max(200),
  body: z.string().trim().min(10, 'Please give your advisor a little more detail').max(5_000),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
