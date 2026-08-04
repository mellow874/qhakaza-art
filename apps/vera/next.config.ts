import type { NextConfig } from 'next';

/**
 * Vera — the public artist website.
 *
 * This is the indexable site. Artists register here, manage their profile and
 * submit work; the marketing pages are meant to rank. Nothing collector-side
 * lives in this app, and it has no route into one.
 */
const nextConfig: NextConfig = {
  /*
   * `next dev` and `next build` share `.next` by default, so an E2E run (which
   * does a full production build) would invalidate a running dev server and
   * leave recently added routes 404ing. Playwright sets NEXT_DIST_DIR.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  /* The shared packages ship TypeScript source, so each app compiles them. */
  transpilePackages: ['@qhakaza/shared-db', '@qhakaza/shared-auth', '@qhakaza/shared-ui'],

  images: {
    // `picsum.photos` is used only by the development seed; real uploads land
    // on the storage host added with artwork submission.
    remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos' }],
  },
};

export default nextConfig;
