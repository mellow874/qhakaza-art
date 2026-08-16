/**
 * @qhakaza/shared-db — the only database access point in the monorepo.
 *
 * Vera, the Collector Platform and the Command Center all import from here. No
 * app defines its own client or connection string; there is one database and
 * one way into it.
 */

export { prisma } from './client';
export * from './env';
export * from './entities';
export * from './actor';
export * from './rls';
