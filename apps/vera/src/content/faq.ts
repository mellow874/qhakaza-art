/**
 * Copy for the FAQ page.
 *
 * The supplied design showed the page heading and the divider lines of the
 * accordion, but no question or answer text was legible. Rather than invent
 * answers about subscriptions, pricing or regulatory status — which would be
 * factual claims about the business — the list is left empty until the real
 * content is supplied. The page renders an honest empty state meanwhile.
 *
 * To populate: add `{ question, answer }` entries below. Nothing else changes.
 */

export const hero = {
  eyebrow: 'FAQ',
  title: 'Frequently Asked Questions',
};

export type FaqItem = { question: string; answer: string };

export const faqs: FaqItem[] = [];

export const emptyState = 'Questions are being added. In the meantime, please get in touch.';

export const cta = {
  title: 'Still have questions?',
  primary: { label: 'Get Started', href: '/login' },
  secondary: { label: 'Contact Us', href: '/contact' },
};
