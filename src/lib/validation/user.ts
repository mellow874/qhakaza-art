import { z } from 'zod';

/** Roles a visitor may choose at sign-up. ADMIN is provisioned out-of-band only. */
export const SIGNUP_ROLES = ['ARTIST', 'COLLECTOR'] as const;

const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email('Enter a valid email address'));

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password is too long');

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(SIGNUP_ROLES).default('COLLECTOR'),
});

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

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

export type SignUpInput = z.infer<typeof signUpSchema>;
export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type ArtistProfileInput = z.infer<typeof artistProfileSchema>;
export type CollectorProfileInput = z.infer<typeof collectorProfileSchema>;
