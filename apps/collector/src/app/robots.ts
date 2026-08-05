import type { MetadataRoute } from 'next';

/**
 * The public membership shell is indexable; the concierge area is not.
 *
 * This is one of three independent mechanisms — the private layout also sets
 * `robots: { index: false }`, and `sitemap.ts` lists only public routes. robots
 * .txt is a request rather than an enforcement, which is exactly why it is not
 * relied on alone: access itself is gated by token in the layout.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/private/', '/login'] }],
    sitemap: `${process.env.AUTH_URL ?? 'http://localhost:3002'}/sitemap.xml`,
  };
}
