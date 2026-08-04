/** All copy for the Features page, transcribed from the supplied design. */

/**
 * Icon keys rather than components — this file stays free of React so it can be
 * imported by tests and server code without pulling in the icon library.
 * `FeatureGrid` maps each key to its icon.
 */
export type FeatureIcon =
  'profile' | 'artwork' | 'documentation' | 'completeness' | 'dashboard' | 'news';

export const hero = {
  eyebrow: 'Platform features',
  title: 'What you get with Qhakaza Art Collective',
  subtitle: 'Every feature on the platform is designed to build structure, not just presence.',
};

export const features: Array<{ icon: FeatureIcon; title: string; body: string }> = [
  {
    icon: 'profile',
    title: 'Artist Profile Setup',
    body: 'A structured intake form covering identity, biography, KYC fields, professional credentials, nationality, and tax residency. Built to the standards required for institutional review.',
  },
  {
    icon: 'artwork',
    title: 'Artwork Records',
    body: 'Register each work as a structured asset record — medium, dimensions, edition, provenance narrative, authorship declaration, custody preference, and primary image.',
  },
  {
    icon: 'documentation',
    title: 'Documentation Suite',
    body: 'Attach and organise certificates of authenticity, provenance documents, condition reports, insurance records, exhibition history, publication references, appraisals, and more.',
  },
  {
    icon: 'completeness',
    title: 'Evidence Completeness Tracking',
    body: 'Every artwork displays a completeness indicator. You always know what evidence is present, what is missing, and what is required to progress.',
  },
  {
    icon: 'dashboard',
    title: 'Personal Dashboard',
    body: 'Monitor your profile completeness, artwork stage statuses, pending documentation, and recent activity — all in one structured view.',
  },
  {
    icon: 'news',
    title: 'News & Insights Access',
    body: 'Receive market intelligence briefings, editorial commentary, regulatory updates, and artist spotlights. Published by Qhakaza Art Collective for artists on the platform.',
  },
];

export const cta = {
  title: 'Structure your practice today.',
  label: 'Get Started',
  href: '/login',
};
