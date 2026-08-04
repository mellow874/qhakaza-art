import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * `next dev` and `next build` share `.next` by default. The E2E suite runs a
   * full production build on every invocation, so running it while a dev server
   * is up overwrites that server's cache underneath it — and the symptom is not
   * a crash but *stale routing*: recently added pages start returning 404 while
   * older ones keep working, until `.next` is deleted.
   *
   * Playwright sets NEXT_DIST_DIR so its build lands somewhere else entirely.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  images: {
    // Hosts artwork may be served from. `picsum.photos` is only used by the
    // development seed; real uploads land on the storage host added in Phase 1.
    remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos' }],
  },
};

export default nextConfig;
