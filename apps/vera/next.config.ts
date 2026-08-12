import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@qhakaza/shared-db', '@qhakaza/shared-auth', '@qhakaza/shared-ui'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;