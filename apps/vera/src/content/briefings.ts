

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
  image: string;
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
    image: '/images/briefing1.jpg',
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
    image: '/images/briefing2.png',
    imageAlt:
      'Visitors at a gallery opening among large gold-toned portrait paintings and bronze figures',
  },
  {
    slug: 'the-artist-as-asset',
    category: 'Research',
    title: 'The Artist as Asset: Building a Practice That Can Be Trusted at Scale',
    excerpt:
      'Further research and commentary from the Qhakaza Art Collective intelligence platform on how artists build trust, structure, and legibility around their practice.',
    date: '2026-05-05',
    dateLabel: '5 May 2026',
    image: '/images/briefing3.png',
    imageAlt: 'Qhakaza Art Collective intelligence briefing',
  },
];