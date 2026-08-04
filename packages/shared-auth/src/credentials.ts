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
