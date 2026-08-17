import type { NextConfig } from 'next';

/**
 * The Collector Platform.
 *
 * Two surfaces in one app, with opposite indexing rules:
 *
 *   /collectors/*       the public membership shell — indexed, carries SEO.
 *                       This is how a prospective collector finds and applies.
 *   /private/<token>/*  the concierge area — invite-only, `noindex`, excluded
 *                       from the sitemap, unreachable without a valid token.
 *
 * Enforced in `robots.ts`, `sitemap.ts` and per-route metadata, not by
 * convention or by remembering.
 */
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@qhakaza/shared-db', '@qhakaza/shared-auth', '@qhakaza/shared-ui', '@qhakaza/shared-email'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos' }],
  },
};

export default nextConfig;
