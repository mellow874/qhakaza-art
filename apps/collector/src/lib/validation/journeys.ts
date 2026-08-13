import { z } from 'zod';

/**
 * The collector journey that is not full onboarding.
 *
 * Kept out of the server-action files: a `"use server"` module may only export
 * async functions, and the client forms validate against these same schemas so
 * the two cannot disagree about what is valid.
 */

const email = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email('Enter a valid email address'));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional();

/**
 * Membership Consideration — for someone who cannot currently meet the fee.
 *
 * Deliberately not the intake form. Asking a person who has just said they
 * cannot afford the membership for their income and liquid-asset bands would be
 * a poor thing to do, so those fields are absent.
 */
export const considerationSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  email,
  country: optionalText(80),
  city: optionalText(80),
  collectingGoal: optionalText(2_000),
  considerationNote: z.string().trim().min(10, 'A sentence or two is enough').max(2_000),
});

export type ConsiderationInput = z.infer<typeof considerationSchema>;
