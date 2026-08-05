import { config } from 'dotenv';

config({ path: '../../.env', quiet: true });

/**
 * Point every database import at the test instance on :5433 *before* any module
 * constructs a PrismaClient. Never let these tests reach the dev database.
 */
const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://qhakaza:qhakaza@localhost:5433/qhakaza_art_test?schema=public';

if (!/:5433\//.test(testUrl)) {
  throw new Error(`TEST_DATABASE_URL must point at the test instance on :5433, got ${testUrl}`);
}

process.env.DATABASE_URL = testUrl;
process.env.AUTH_SECRET ??= 'test-secret-not-used-in-production';
