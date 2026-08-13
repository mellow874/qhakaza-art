/**
 *
 * Content is kept separate from components so wording and media references
 * can be edited without touching layout or application logic.
 */



export const hero = {
  eyebrow: 'Artist Intelligence Platform',
  title: 'Your practice,',
  titleEmphasis: 'structured for serious attention',
  subtitle: 'Make your practice easier to trust, present, and collect',
  footEyebrow: 'African Art Intelligence',
  footLine: 'Qhakaza Art Collective',

  video: '/videos/home1.mp4',
  imageAlt:
    'Paint-loaded brushes drawing red and orange pigment across a white surface',
};

export const artistNeeds = {
  eyebrow: 'What the artist needs',
  title: 'A serious structure for a serious practice',
  subtitle: 'For artists whose work is ready to move beyond casual visibility',

  items: [
    {
      number: '01',
      question: 'Will my work be taken seriously?',
      answer:
        'Build the record behind your practice so the work can be understood, trusted, and introduced with confidence',
    },
    {
      number: '02',
      question: 'What should support the work?',
      answer:
        'Bring together the details, documents, provenance, evidence, and context that allow serious audiences to look closer',
    },
    {
      number: '03',
      question: 'How do I reach the right collectors?',
      answer:
        'Prepare the practice for considered introduction to galleries, collectors, advisors, and institutions',
    },
    {
      number: '04',
      question: 'Is my practice ready?',
      answer:
        'Your Sx Score shows where the record behind your work is strong, and where greater discipline is still required',
    },
  ],
};

export const framework = {
  eyebrow: 'Our framework',
  quote: 'The problem is not the absence of quality.',
  quoteEmphasis: 'It is the absence of structure.',
  imageAlt: 'A painting installation with layered surfaces and a strong gallery atmosphere.',
  video: '/videos/home3.mp4',
};

export const sxScore = {
  eyebrow: 'Evidence framework',
  title: 'The Sx Score',
  description:
    'The Sx Score measures how valuation-ready an artwork is based on documentation strength, market evidence, liquidity signals, narrative validation, and compliance structure',
  attribution: 'Qhakaza Art Collective · Internal evidence framework',

  metrics: [
    { code: 'CAM', label: 'Documentation strength', value: 72 },
    { code: 'MCP', label: 'Market evidence', value: 48 },
    { code: 'ALS', label: 'Liquidity signals', value: 30 },
    { code: 'NIS', label: 'Narrative validation', value: 55 },
    { code: 'CSI', label: 'Compliance structure', value: 65 },
  ],

  total: 54,
  totalOutOf: 100,
  band: 'Emerging Asset',
};

export const platformPreview = {
  eyebrow: 'Platform preview',
  title: 'Built for the rooms where details matter',
  description:
    'Each artist is presented through a structured record built to carry trust: the artworks, the context, the provenance, the documentation, the pricing logic, and the evidence serious audiences expect before they collect, exhibit, advise, or introduce the work',

  checklist: [
    'Identity intake completed',
    'Artworks registered with full metadata',
    'Documentation evidence attached',
    'Provenance narrative on record',
  ],

  image: '/images/artist3.jpeg',
  video: '/videos/home1.mp4',

  // Illustrative record shown in the design, not live data.
  sample: {
    artist: {
      name: 'Marcus Adeyemi',
      detail: 'Lagos, Nigeria · Contemporary Painting',
    },

    works: [
      {
        title: 'Untitled, Lagos Series IV',
        reference: 'QAC-001',
        score: 92,
        status: 'Visibility Ready',
      },
      {
        title: 'Study for Interior No. 3',
        reference: 'QAC-002',
        score: 68,
        status: 'Under Review',
      },
      {
        title: 'Coastal Abstraction, 2024',
        reference: 'QAC-003',
        score: 41,
        status: 'Needs Evidence',
      },
    ],
  },
};

// Briefings live in `content/briefings.ts` — shared with the /briefings index.

export const begin = {
  eyebrow: 'Begin',
  title: 'Begin structuring your practice.',
  description:
    'Open to any artist. Subscribe and access the Qhakaza Art Collective platform immediately. Build your structured profile, register your artworks, and present your practice with professional clarity.',

  primaryCta: {
    label: 'Enter the suite',
    href: '/login',
  },

  secondaryCta: {
    label: 'About the collective',
    href: '/about',
  },

  image: '/images/about1.jpeg',
  imageAlt: 'A worn paintbrush resting on a painted wooden surface',
  video: '/videos/home1.mp4',
};