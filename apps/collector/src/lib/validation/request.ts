import { z } from 'zod';

import { request } from '@/content/collectors';

/**
 * Private request form validation.
 *
 * Stores: name, email, subject (request type), message (your request).
 * Maps to ContactMessage table in the database.
 */

const REQUEST_TYPES = request.form.types.map((type) => type.value);

export const privateRequestSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required').max(120),
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.email('Enter a valid email address')),
  subject: z
    .string()
    .trim()
    .min(1, 'Please select the type of request')
    .refine((value) => REQUEST_TYPES.includes(value), 'Please select a valid request type'),
  message: z
    .string()
    .trim()
    .min(1, 'Your request is required')
    .max(5_000, 'Your request must be under 5,000 characters'),
});
