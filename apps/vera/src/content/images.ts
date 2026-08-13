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
  hero: '/images/photo-1(1).png',
  framework: '/images/photo-1(1).png',
  begin: '/images/photo-3.jpg',
  aboutDocuments: '/images/photo-1(1).png',
  'briefing-when-art-becomes-an-asset': '/images/photo-4.png',
  'briefing-the-visibility-gap': '/images/photo-3.jpg',

  // Collector Intelligence Suite — no assets yet
  'collector-hero': null,
  'collector-belief': null,
  'collector-experience': null,
};
