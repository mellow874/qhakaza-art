/**
 * Fail a deployment before it starts, not on its first request.
 *
 *   npx tsx packages/shared-db/scripts/check-env.ts
 *
 * Reports every problem at once rather than the first, so a fresh environment
 * learns everything it is missing in one pass instead of one redeploy each.
 */
import './load-env';

import { collectEnvironmentProblems, currentEnvironment } from '../src/env';

const problems = collectEnvironmentProblems();

console.log(`Environment: ${currentEnvironment()}`);

if (problems.length === 0) {
  console.log('All required configuration is present.');
  process.exit(0);
}

console.error(`\n${problems.length} problem(s):\n`);
for (const problem of problems) console.error(`  - ${problem}`);
console.error('\nSee .env.example for the full list, MIGRATION_RUNBOOK.md for where values come from.');
process.exit(1);
