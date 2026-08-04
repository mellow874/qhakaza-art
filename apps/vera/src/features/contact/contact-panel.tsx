'use client';

import { submitContactMessage } from './actions';
import { ContactForm } from './contact-form';

/**
 * Connects the form to the server action. Kept separate so the form itself
 * stays a pure component with no server dependency, and can be tested directly.
 */
export function ContactPanel() {
  return <ContactForm onSubmit={submitContactMessage} />;
}
