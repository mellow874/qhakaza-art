import { z } from 'zod';

/*
 * `signUpSchema` and `SIGNUP_ROLES` were removed here.
 *
 * Vera creates artists and nothing else, so the role is fixed in the server
 * action rather than chosen in the payload. Account fields now come from
 * `newAccountSchema` in @qhakaza/shared-auth, which both sites share.
 */

const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email('Enter a valid email address'));

// `credentialsSchema` lives in @qhakaza/shared-auth: all three apps sign in
// against the same accounts, so one definition serves client and server alike.

export const artistProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(120),
  statement: z.string().trim().max(2_000).optional(),
  socials: z.record(z.string(), z.url('Social links must be full URLs')).optional(),
});

export const collectorProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  bio: z.string().trim().max(1_000).optional(),
  avatar: z.url().optional(),
});

export const contactMessageSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: emailSchema,
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  message: z.string().trim().min(10, 'Please give us a little more detail').max(5_000),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

export type ArtistProfileInput = z.infer<typeof artistProfileSchema>;
export type CollectorProfileInput = z.infer<typeof collectorProfileSchema>;
