import { z } from 'zod';

/**
 * What a sign-in attempt must look like.
 *
 * Lives here rather than in an app's validation module: all three apps
 * authenticate against the same accounts, and `server.ts` used to import this
 * from Vera — a shared package reaching into an app, which broke the moment
 * Vera moved. Sign-in is auth's own concern, so it owns the schema.
 */
export const credentialsSchema = z.object({
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.email('Enter a valid email address')),
  // Deliberately only `min(1)`: this validates a *submission*, not a new
  // password. Applying strength rules here would leak them to anyone probing
  // the login form, and would lock out accounts created under older rules.
  password: z.string().min(1, 'Password is required'),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;

/**
 * A new account: who they are and how they will sign in.
 *
 * Deliberately carries NO role. Each site creates exactly one kind of account
 * and fixes the role server-side — Vera makes artists, the Collector Platform
 * makes collectors. A role in the payload would be a role the browser could
 * choose, which is how a public form becomes a way to enrol yourself as staff.
 */
export const newAccountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.email('Enter a valid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long'),
});

export type NewAccountInput = z.infer<typeof newAccountSchema>;
