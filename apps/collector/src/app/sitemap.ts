import type { MetadataRoute } from 'next';

/**
 * Public routes only.
 *
 * `/private/*` is absent by construction, not by filtering: this is a literal
 * list of the membership shell's pages. A sitemap built by walking the route
 * tree would eventually pick the private area up when someone added a page.
 */
const PUBLIC_ROUTES = [
  '/collectors',
  '/collectors/about',
  '/collectors/membership',
  '/collectors/methodology',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.AUTH_URL ?? 'http://localhost:3002';

  return PUBLIC_ROUTES.map((route) => ({
    url: `${origin}${route}`,
    changeFrequency: 'monthly' as const,
    priority: route === '/collectors' ? 1 : 0.7,
  }));
}
