/**
 * Photography for the Collector Intelligence Suite.
 *
 * Each app owns its own registry and passes entries to `EditorialImage`;
 * the shared component no longer reaches into app content to resolve a name.
 *
 * Every entry is `null` until the real asset is supplied — `EditorialImage`
 * renders a tinted placeholder in that case, so layout and spacing are correct
 * without shipping broken image references.
 */
export const IMAGES: Record<string, string | null> = {
  'collector-hero': '/hero-bg.png',
  'collector-belief': '/belief-collector.png',
  'collector-experience': '/featured-dinner.png',
};
