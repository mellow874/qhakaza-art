/** Site-wide navigation, shared by the header and footer. */

export const MAIN_NAV = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/briefings', label: 'Briefings' },
  { href: '/faq', label: 'FAQ' },
] as const;

export const FOOTER_COLUMNS = [
  {
    heading: 'Platform',
    links: [
      { href: '/how-it-works', label: 'How It Works' },
      { href: '/features', label: 'Features' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/briefings', label: 'Briefings' },
      { href: '/faq', label: 'FAQ' },
      { href: '/contact', label: 'Contact' },
      // Not in any supplied design. Added because nothing else on the artist
      // site reaches the collector sub-brand — it was only findable by typing
      // the URL. Remove if the two are meant to stay unlinked in public.
      { href: '/collectors', label: 'Collector Intelligence Suite' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
    ],
  },
] as const;

export const FOOTER_TAGLINE =
  'A home for serious African artists who are ready to shape the work around their work';

export const FOOTER_MARK = 'African Art Intelligence';

export const SUITE_CTA = { href: '/login', label: 'Enter the suite' };
export const SIGN_IN = { href: '/login', label: 'Sign in' };
