/**
 * The Private Note — an RSVP-style invitation for prospective collectors.
 *
 * Copy is written to match the collector suite's register (quiet, unhurried,
 * "private route" rather than "sign up now"). No design was supplied for this
 * page, so it reuses the suite's existing tokens and section rhythm rather than
 * introducing anything new.
 */

export const privateNote = {
  eyebrow: 'An invitation',
  title: 'The Private Note',
  lede: 'Before anything is prepared for you, we would like to know what you are drawn to. This is not an application. It is a note, read by one person, that shapes everything we bring you afterwards.',
  aside: 'A few quiet minutes. Nothing here is a commitment.',

  /**
   * ⚠ PLACEHOLDER — no audio file has been supplied.
   *
   * `src` is null on purpose, and the player renders in a clearly-labelled
   * unavailable state rather than pointing at a file that does not exist. Drop
   * the track into `apps/collector/public/audio/` and set `src` to its path;
   * nothing else needs to change.
   *
   * Playback is opt-in, never autoplay: browsers block un-muted autoplay, so an
   * autoplaying page would simply sit silent and look broken.
   */
  audio: {
    src: null as string | null,
    title: 'A note to sit with',
    placeholder: 'Music will play here once the track is added.',
    play: 'Play music',
    pause: 'Pause music',
  },

  sections: {
    interests: {
      title: 'What you are drawn to',
      note: 'However loosely held — this is a starting point, not a filter.',
    },
    preferences: {
      title: 'How you prefer to collect',
      note: 'Pace and manner matter more to us than volume.',
    },
    serve: {
      title: 'How we can serve you',
      note: 'The most useful part of this note. Say as much or as little as you like.',
    },
  },

  fields: {
    fullName: { label: 'Full name', placeholder: 'As it should appear' },
    email: { label: 'Email address', placeholder: 'For all correspondence' },

    mediums: { label: 'Mediums that hold your attention' },
    regions: { label: 'Regions you are curious about' },
    subjects: {
      label: 'Subjects or themes',
      placeholder: 'Portraiture, land and memory, abstraction, the everyday…',
    },

    acquisitionPace: { label: 'Acquisition pace' },
    budgetBand: { label: 'Typical range per work' },
    advisoryStyle: { label: 'How much guidance' },
    contactStyle: { label: 'How often you would like to hear from us' },

    building: {
      label: 'What are you building, and why',
      placeholder: 'A room, a record, something to pass on…',
    },
    frustrations: {
      label: 'What has frustrated you elsewhere',
      placeholder: 'Anything that has made collecting harder than it should be',
    },
    goodOutcome: {
      label: 'What would a good year look like',
      placeholder: 'Twelve months from now, what would make this worthwhile?',
    },
    mayContact: {
      label: 'You may contact me about what I have written here',
    },
  },

  // Reuses the intake's medium list verbatim so the two vocabularies agree.
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

  regions: [
    'West Africa',
    'East Africa',
    'Southern Africa',
    'North Africa',
    'Central Africa',
    'The diaspora',
  ],

  acquisitionPaces: [
    { value: 'FIRST', label: 'Still finding my footing' },
    { value: 'OCCASIONAL', label: 'A work or two a year' },
    { value: 'STEADY', label: 'Building steadily' },
    { value: 'ACTIVE', label: 'Actively building a collection' },
  ],

  /**
   * ⚠ PROVISIONAL, like the intake's financial bands. These are stand-ins
   * sized to the stated audience, not Qhakaza's own segmentation.
   */
  budgetBands: [
    { value: 'UNDER_2K', label: 'Under $2,000' },
    { value: '2K_10K', label: '$2,000 – $10,000' },
    { value: '10K_50K', label: '$10,000 – $50,000' },
    { value: 'OVER_50K', label: 'Over $50,000' },
    { value: 'UNDISCLOSED', label: 'Prefer not to say' },
  ],

  advisoryStyles: [
    { value: 'LED', label: 'Guide me closely' },
    { value: 'BALANCED', label: 'A considered second opinion' },
    { value: 'INDEPENDENT', label: 'I prefer to decide alone' },
  ],

  contactStyles: [
    { value: 'RARELY', label: 'Only when it matters' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'REGULARLY', label: 'Whenever something is relevant' },
  ],

  submitLabel: 'Send my note',
  submittingLabel: 'Sending…',
  received: {
    title: 'Thank you — your note has been received',
    body: 'One person will read it, and what we prepare for you from here will be shaped by it.',
  },
  error: 'We could not send your note. Please try again.',
};
