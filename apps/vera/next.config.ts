import path from 'node:path';
import { config } from 'dotenv';
config({ path: '../../.env', quiet: true });

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@qhakaza/shared-db', '@qhakaza/shared-auth', '@qhakaza/shared-ui'],
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
};

export default nextConfig;