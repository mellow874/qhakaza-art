import type { MetadataRoute } from 'next';

/** Nothing here is public. The console is staff-only and should never be indexed. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
