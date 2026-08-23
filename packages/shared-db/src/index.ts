/**
 * @qhakaza/shared-db — the only database access point in the monorepo.
 *
 * Vera, the Collector Platform and the Command Center all import from here. No
 * app defines its own client or connection string; there is one database and
 * one way into it.
 */

export { prisma } from './client';
// The generated namespace, for callers that need Prisma's own input types.
export { Prisma } from '@prisma/client';
export * from './env';
export * from './entities';
export * from './token';
export * from './invitation-lifecycle';
export * from './actor';
export * from './rls';
// Test helpers. Exported because the app suites import them across packages.
export * from './test-visibility';
