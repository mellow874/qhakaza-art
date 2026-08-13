/**
 * Copy for the Collector Intelligence Suite landing page, transcribed from the
 * supplied design.
 *
 * This is a separate sub-brand from the artist-facing site: its own wordmark,
 * navigation, footer and a light palette. Kept in its own file for that reason.
 */

export const brand = {
  name: 'Qhakaza Art Collective',
  suite: 'Collector Intelligence Suite',
};

/**
 * Vera — the artist website. A different application on a different domain, so
 * it cannot be reached with a path.
 *
 * `NEXT_PUBLIC_` because the footer is rendered on the client too; the value is
 * inlined at build time. The localhost fallback keeps development working
 * without configuration, and is never what production uses because every
 * deployment sets the variable.
 */
export const VERA_URL = process.env.NEXT_PUBLIC_VERA_URL ?? 'http://localhost:3001';

/**
 * The navigation labels are the design's. The destinations are the pages that
 * actually exist.
 *
 * The design named four nav items but only supplied designs for two of the
 * pages behind them, so `/collectors/suite` and `/collectors/pricing` were
 * links to nothing — a 404 from the site's own header. Rather than invent two
 * pages, each label now points at the page that already carries its content:
 *
 *   Suite   → the landing page, which is the description of the suite
 *   Pricing → the membership page, which is where the $10,000/year sits
 *
 * If dedicated pages are designed later, these are two href changes.
 */
export const NAV = [
  { href: '/collectors', label: 'Suite' },
  { href: '/collectors/about', label: 'About' },
  { href: '/collectors/membership', label: 'Membership' },
  { href: '/collectors/membership', label: 'Pricing' },
] as const;

export const APPLY_CTA = { href: '/collectors/apply', label: 'Apply' };

export const hero = {
  eyebrow: 'Members-only collector intelligence',
  kicker: 'Collector Intelligence Suite',
  title: 'The Private Route Into African Contemporary Art',
  body: 'A private collector environment where African contemporary art is experienced, understood, and acquired through trusted access to carefully vetted emerging artists, verified records, clear pricing context, market intelligence, and discreet, invitation-only experiences',
  note: 'For those who prefer an intelligent, culturally rooted entry into African art collecting',
  primaryCta: { label: 'Begin collector intake', href: '/collectors/apply' },
  // Down to what the suite offers, on this same page — there is no separate
  // /collectors/suite, and this button used to lead to a 404.
  secondaryCta: { label: 'Explore the suite', href: '#what-you-receive' },
  membershipNote:
    'Annual membership for serious collectors seeking private access, trusted context, and premium acquisition pathways',
  imageAlt:
    'A sunset-lit interior with a large abstract portrait and a carved figure on a side table',
};

export const benefits = {
  eyebrow: 'Membership benefits',
  title: 'What You Receive',
  items: [
    {
      title: 'Collector Intelligence',
      body: 'Understand artist credibility, pricing context, documentation status, and collector relevance before you take the next step',
    },
    {
      title: 'Artist Intelligence Records',
      body: 'Review structured artist insight – biography, career stage, exhibition signals, and pricing – prepared for serious collector scrutiny',
    },
    {
      title: 'Artwork Intelligence Records',
      body: 'See the evidence behind each work, including provenance notes, availability, pricing context, risk considerations, and suggested next steps',
    },
    {
      title: 'Private Experiences',
      body: 'Access viewings, dinners, studio visits, advisor calls, and curated encounters with other collectors in an intimate, hosted setting',
    },
    {
      title: 'Dashboard Access',
      body: 'Follow your saved interests, private requests, and curated opportunities in one calm, personalised member environment',
    },
    {
      title: 'News & Insights',
      body: 'Receive market context, collector education, and cultural intelligence designed to deepen confidence over time, not overwhelm it',
    },
  ],
};

export const belief = {
  eyebrow: 'Our belief',
  titleLines: ['Attention is Public', 'Access is Private'],
  body: 'A private, more intelligent route into African art for those who want more than discovery alone',
  cta: { label: 'Begin your collector journey', href: '/collectors/apply' },
  imageAlt: 'A collector seated with a portfolio of works in a sunlit room hung with African art',
};

export const preview = {
  eyebrow: 'Intelligence preview',
  title: 'What Intelligence Looks Like',
  artistRecord: {
    kind: 'Artist Intelligence Record',
    badge: 'Emerging',
    title: 'Naledi Mokoena',
    subtitle: 'Johannesburg, South Africa',
    rows: [
      { label: 'Medium', value: 'Mixed media and painting' },
      { label: 'Price range', value: '$1,400 – $3,500' },
      { label: 'Documentation', value: 'Strong' },
    ],
    tags: ['Group exhibition history', 'Consistent body of work', 'Certificate records'],
    note: {
      label: 'Intelligence note',
      body: 'Naledi shows a consistent visual language, clear thematic direction, and collector-accessible pricing — suitable for collectors seeking early exposure to contemporary African mixed-media practice',
    },
  },
  artworkRecord: {
    kind: 'Artwork Intelligence Record',
    badge: 'Available',
    title: 'Quiet Inheritance',
    subtitle: 'Naledi Mokoena, 2025',
    rows: [
      { label: 'Price', value: '$2,600' },
      { label: 'Certificate', value: 'Available' },
      { label: 'Pricing context', value: 'Within established range for artist' },
      { label: 'Risk note', value: 'Emerging artist — early exposure' },
      { label: 'Suggested step', value: 'Request private viewing' },
    ],
  },
};

export const experience = {
  eyebrow: 'Featured experience',
  title: 'Private Collector Dinner: African Art, Stewardship and Capital',
  highlights: [
    'Artist-led storytelling',
    'Curated collector education',
    'Private acquisition conversations',
  ],
  cta: { label: 'Request access', href: '/collectors/request-access' },
  imageAlt:
    'Guests at a candlelit dinner table while a host speaks, surrounded by African artworks',
};

export const news = {
  eyebrow: 'From the suite',
  title: 'News & Insights',
  items: [
    { category: 'Collector Intelligence', title: 'What Makes an Emerging Artist Credible?' },
    { category: 'Collector Intelligence', title: 'How to Read Pricing Context Before Buying' },
    { category: 'Collector Education', title: 'Why Documentation Matters in Art Acquisition' },
    { category: 'Member Events', title: 'Private Viewings and Collector Education' },
  ],
};

export const closing = {
  title: 'Enter African Art with Quiet Confidence',
  body: 'Private access, structured intelligence, and trusted context for serious collectors',
  cta: { label: 'Begin collector intake', href: '/collectors/apply' },
};

export const footer = {
  tagline: 'A private gateway into carefully vetted emerging African art',
  // Same principle as NAV: the design's labels, pointing at the sections that
  // hold the content. The anchors are real element ids on the landing page.
  columns: [
    {
      heading: 'Suite',
      links: [
        // The artist site itself, not the preview of its records on this page.
        { href: VERA_URL, label: 'Artist Intelligence' },
        { href: '/collectors#intelligence-preview', label: 'Artwork Intelligence' },
        { href: '/collectors#what-you-receive', label: 'Intelligence' },
        { href: '/collectors/request-access', label: 'Request Access' },
      ],
    },
    {
      heading: 'Discover',
      links: [
        { href: '/collectors/about', label: 'About Qhakaza' },
        { href: '/collectors', label: 'Collector Intelligence' },
        { href: '/collectors#featured-experience', label: 'Private Experiences' },
        // "Artists" is deliberately absent. It pointed at `/artists`, which is
        // a Vera route and 404s here — and the artists a member may see are
        // behind `/private`, so there is nothing public to link to.
        { href: '/collectors/methodology', label: 'Methodology' },
      ],
    },
    {
      heading: 'Access',
      links: [
        { href: '/collectors/membership', label: 'Membership' },
        { href: '/collectors/apply', label: 'Begin Intake' },
      ],
    },
  ],
  note: 'Private access. Curated intelligence. Quiet confidence.',
};

export const about = {
  eyebrow: 'About Qhakaza',
  title: 'A Private Gateway into African Art',
  lede: 'Founded on the belief that collectors deserve serious intelligence: structured, honest, and culturally rooted',
  mission: {
    title: 'Our Mission',
    paragraphs: [
      "To build a private culture of African art collecting that offers global collectors a composed, well-prepared route into the work, and in doing so helps lift Africa's share of the global art market toward 5% by 2035",
      'African art has produced some of the most important work of the last three decades. Its underrepresentation is not a question of quality, but of infrastructure: consistent documentation, clear pricing context, independent credibility signals, and a collector-facing culture that supports long-term commitment rather than short-term attention',
      'This membership is designed to sit alongside galleries, advisors and institutions as a quiet, structured layer that makes it easier for capital, connoisseurship and time to move into African art with confidence',
    ],
  },
  story: {
    eyebrow: 'The story',
    paragraphs: [
      'For years, Africa has accounted for less than one percent of the global art market, despite producing some of the most urgent and inventive work of the last few decades. The imbalance was not about a lack of artists or ideas. It was about the absence of a collector culture and infrastructure that could hold the work properly: rooms, records, rituals, and routes that matched the quality of the art',
      'Qhakaza was conceived as a quiet answer to that gap. The name, from isiZulu, means to flourish and to blossom, and it reflects a conviction that artists, collections and the relationships around them deserve conditions that allow for exactly that',
      'Rather than another open marketplace, Qhakaza is structured as a private culture of collecting. It brings together intelligence, hospitality and a particular social setting to offer a more composed route into African contemporary art for those who wish to live with it at a higher standard. The ambition is simple: to help create a world in which African art, and the collectors who commit to it, occupy more space and move with greater confidence',
    ],
  },
  structure: {
    eyebrow: 'Structure',
    title: 'How We Are Organised',
    teams: [
      {
        title: 'Intelligence',
        body: 'Our research team evaluates, documents, and maintains artist and artwork records',
      },
      {
        title: 'Experience',
        body: 'Our experience team curates private viewings, dinners, studio visits, and collector encounters',
      },
      {
        title: 'Advisory',
        body: 'Our advisory team works directly with member collectors to build personalised acquisition pathways',
      },
    ],
  },
  closing: {
    title: 'Begin Your Collector Journey',
    cta: { label: 'Begin collector intake', href: '/collectors/apply' },
  },
};

export const apply = {
  eyebrow: 'Collector intake',
  title: 'Begin Your Application',
  lede: 'This form begins the process of joining Qhakaza as a member collector. Your information is held privately and used only to prepare your experience.',
  personal: {
    title: 'Personal Details',
    fullName: { label: 'Full name', placeholder: 'As it should appear' },
    email: { label: 'Email address', placeholder: 'For all correspondence' },
    phone: { label: 'Phone', placeholder: 'International format preferred' },
    country: { label: 'Country of residence', placeholder: 'Country' },
    city: { label: 'City', placeholder: 'City' },
  },
  financial: {
    title: 'Financial Profile',
    placeholder: 'Select range',
    income: { label: 'Annual income band' },
    assets: { label: 'Liquid assets band' },
    // ⚠ PROVISIONAL. The design shows only the "Select range" placeholder — the
    // options behind it were never supplied. These are stand-ins sized to the
    // stated audience ("new global executive collectors", $10,000/year), not
    // Qhakaza's real segmentation. Replace with the client's own bands before
    // this form is shown to an applicant.
    incomeBands: [
      { value: 'UNDER_250K', label: 'Under $250,000' },
      { value: '250K_500K', label: '$250,000 – $500,000' },
      { value: '500K_1M', label: '$500,000 – $1 million' },
      { value: '1M_5M', label: '$1 million – $5 million' },
      { value: 'OVER_5M', label: 'Over $5 million' },
      { value: 'UNDISCLOSED', label: 'Prefer not to say' },
    ],
    assetBands: [
      { value: 'UNDER_500K', label: 'Under $500,000' },
      { value: '500K_1M', label: '$500,000 – $1 million' },
      { value: '1M_5M', label: '$1 million – $5 million' },
      { value: '5M_25M', label: '$5 million – $25 million' },
      { value: 'OVER_25M', label: 'Over $25 million' },
      { value: 'UNDISCLOSED', label: 'Prefer not to say' },
    ],
  },
  collecting: {
    title: 'Collecting Context',
    goal: { label: 'Collecting goal', placeholder: 'What brings you to African art collecting?' },
    exposure: {
      label: 'Art exposure',
      placeholder: 'Describe your current relationship with art collecting',
    },
    mediumsLabel: 'Preferred mediums',
    mediums: [
      'Painting',
      'Sculpture',
      'Photography',
      'Textile',
      'Mixed Media',
      'Print',
      'Drawing',
      'Installation',
      'Video',
    ],
  },
  submitLabel: 'Continue to verification',
  submittingLabel: 'Saving…',
  // ⚠ Not from a design. The button promises a verification step that has not
  // been supplied, so rather than send applicants to a 404 the intake confirms
  // what was saved and what happens next. Replace when that screen arrives.
  received: {
    title: 'Your intake has been received',
    body: 'Qhakaza has your details. The verification step follows, and we will be in touch to arrange it.',
    // The Private Note is offered here because this is the moment it is for:
    // the intake captures who someone is, the note captures what they are
    // drawn to, and everything prepared for them afterwards is shaped by it.
    // Optional, and framed as such — it is a note, not another form to clear.
    nextStep: {
      label: 'Write your Private Note',
      href: '/collectors/private-note',
      body: 'If you have a few more quiet minutes, tell us what you are drawn to. It shapes what we prepare for you.',
    },
  },
  error: 'We could not save your application. Please try again.',
};

export const membership = {
  eyebrow: 'Founding circle membership',
  titleLines: ['A Private Social Club', 'Centered Around African Art Collecting'],
  lede: 'Built for new global executive collectors entering the field with taste, context, and trusted access.',
  price: {
    amount: '$10,000',
    period: '/ year',
    label: 'Annual membership consideration',
    note: 'For collectors seeking a serious, guided route into African contemporary art.',
  },
  cta: { label: 'Request membership consideration', href: '/collectors/membership-consideration' },
  rhythmNote: {
    title: "The club is built around the collector's time",
    body: 'The calendar is kept intentionally light. What matters is not frequency, but the quality of the moments, the access around them, and the continuity that follows',
  },
  // The design gives this list no heading of its own — just a rule and the
  // items. Left unnamed rather than inventing a heading for it.
  includes: [
    'Collector intelligence on selected African contemporary artists and works',
    'Prepared access to artists, galleries, studios, and private rooms',
    'Private experiences shaped around meaningful collecting conversations',
    'Collection formation support through taste, context, documentation, and acquisition readiness',
    'A more private social world around African art collecting',
  ],
  rhythm: {
    title: 'The annual collector rhythm',
    items: [
      'A principal annual gathering',
      'A small number of selective experiences across the year',
      'Year-round collector intelligence and artist context',
      'Carefully prepared access when the right opportunities arise',
      'A more continuous private relationship with the field',
    ],
  },
  access: {
    title: 'How access is considered',
    body: 'Membership consideration begins with a short collector intake. It helps Qhakaza understand your context, interests, pace, and route before access is prepared.',
  },
  closing: {
    eyebrow: 'Request membership consideration',
    title: 'The route begins with a conversation, not a checkout.',
    body: 'Begin with a short collector intake. It takes a few quiet minutes and shapes everything that follows.',
    cta: {
      label: 'Request membership consideration',
      href: '/collectors/membership-consideration',
    },
  },
};

export const methodology = {
  eyebrow: 'The methodology',
  title: 'Methodology',
  lede: 'We come to know the collector, prepare the route, and receive them in a world arranged around that understanding',
  steps: [
    {
      title: 'Collector first',
      body: "Every relationship begins with the person, not the inventory. We build a private profile of the collector's pace, privacy, appetite and direction, so that what follows is aligned with who they are and what they are building. The profile is a living document, refined quietly over time",
    },
    {
      title: 'Intelligence before invitation',
      body: 'Nothing is placed in front of a member without passing through a disciplined reading. Artists and works are assessed for documentation, provenance, institutional and exhibition signals, pricing behaviour and risk. By the time something reaches the collector, it has already been weighed, documented and set in context',
    },
    {
      title: 'Hospitality',
      body: 'Hospitality is where the methodology takes physical form. Dinners, viewings and studio visits are arranged with the same discipline as the intelligence behind them, each one shaped by a clear sense of pace, company, atmosphere and cultural tone. The result is not a generic service experience, but entry into a private world with its own standards, rhythm and taste',
    },
    {
      title: 'Discretion and scale',
      body: 'Membership is intentionally limited. We prefer to know each member well enough to remember their preferences, their boundaries and the rhythm of their lives. Visibility is never assumed; it is requested. Communication is measured. The experience should feel as private as a house account, not as public as a platform',
    },
    {
      title: 'Routes, not moments',
      body: 'We think in sequences rather than single transactions. Each introduction, dossier, viewing or dinner is placed inside a longer route for the collection: how it shapes the arc, balances risk, and adds weight where it is deserved. The test of our work is not the volume of activity, but the coherence of the collection and the calm with which it is built',
    },
  ],
  essence: {
    eyebrow: 'In essence',
    body: 'A private membership that offers collectors a composed way into African contemporary art, translating the work of artists, curators, galleries and advisors into clear intelligence, quiet preparation and well-timed access',
  },
  cta: { label: 'Apply for membership', href: '/collectors/membership-consideration' },
};
