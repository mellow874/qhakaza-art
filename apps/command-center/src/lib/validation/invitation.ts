import { z } from 'zod';

/**
 * What an admin fills in to invite someone.
 *
 * Kept out of the `"use server"` action file: such a module may only export
 * async functions, and the client form validates against this same schema so
 * the two cannot disagree about what is valid.
 */
export const invitationInputSchema = z.object({
  /**
   * Optional. The brief asks for a name, but an invitation carrying only an
   * address is still a valid invitation, and refusing to send one because a
   * surname is unknown would be the wrong trade. The email greets by name when
   * it has one and says "Hello" when it does not.
   */
  recipientName: z
    .string()
    .trim()
    .max(120)
    .transform((value) => (value === '' ? null : value))
    .nullish()
    .transform((value) => value ?? null),

  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.email('Enter a valid email address')),

  recipientTypeId: z.string().min(1, 'Choose who this invitation is for'),
});

export type InvitationInput = z.infer<typeof invitationInputSchema>;
