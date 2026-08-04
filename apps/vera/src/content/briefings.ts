/**
 * Intelligence Briefings, transcribed from the supplied designs.
 *
 * Shared by the home page's briefings strip and the /briefings index, so the
 * two can never drift apart.
 *
 * The excerpts are exactly the text shown in the design, truncation included —
 * the full article bodies have not been supplied, so nothing here is invented.
 * Individual articles at /briefings/<slug> are not built yet.
 */

export const hero = {
  eyebrow: 'Research & commentary',
  title: 'News & Insights',
};

export const homeStrip = {
  eyebrow: 'Research & commentary',
  title: 'Intelligence Briefings',
  allLabel: 'All briefings',
};

export type Briefing = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  date: string;
  dateLabel: string;
  imageAlt: string;
};

export const briefings: Briefing[] = [
  {
    slug: 'when-art-becomes-an-asset',
    category: 'Market Intelligence',
    title: 'When Art Becomes an Asset: What Collectors Know and Artists Must Learn',
    excerpt:
      'Art has always lived between two worlds. In one world, it is expression, memory, identity, ritual, beauty, rebellion, and cultural…',
    date: '2026-05-07',
    dateLabel: '7 May 2026',
    imageAlt:
      'A draped metallic sculpture on a white plinth in a gallery, with framed paintings behind',
  },
  {
    slug: 'the-visibility-gap',
    category: 'News',
    title: 'The Visibility Gap: Why Emerging Artists Need More Than Exposure',
    excerpt:
      'As the global art world becomes more structured around fairs, awards, public programming, institutional partnerships, and curat…',
    date: '2026-05-06',
    dateLabel: '6 May 2026',
    imageAlt:
      'Visitors at a gallery opening among large gold-toned portrait paintings and bronze figures',
  },
];
