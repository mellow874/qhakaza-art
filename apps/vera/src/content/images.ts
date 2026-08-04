/**
 * Photography used across the marketing pages.
 *
 * Every entry is `null` until the real asset is supplied — `EditorialImage`
 * renders a tinted placeholder in that case, so layout and spacing are correct
 * without shipping broken image references.
 *
 * To add a photo: drop the file in `public/images/` and set the path here, e.g.
 *   hero: '/images/hero-brushes.jpg'
 */
export const IMAGES: Record<string, string | null> = {
  hero: null,
  framework: null,
  begin: null,
  aboutDocuments: null,
  'briefing-when-art-becomes-an-asset': null,
  'briefing-the-visibility-gap': null,

  // Collector Intelligence Suite
  'collector-hero': null,
  'collector-belief': null,
  'collector-experience': null,
};
