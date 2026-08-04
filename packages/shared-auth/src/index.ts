/**
 * @qhakaza/shared-auth — authentication, session and the role model.
 *
 * Framework-free by design at the core (`rbac`), so the same rules serve the
 * edge proxy, server components and server actions in all three apps.
 *
 * Server-only entry points are NOT re-exported here:
 *   - `./server`  — the Auth.js instance (pulls in Prisma and bcrypt)
 *   - `./guards`  — requireRole / requireToken (touch the database)
 *   - `./config`  — the edge-safe Auth.js config
 * Importing those from a client component would drag Node built-ins into the
 * browser bundle, so they are reached by explicit subpath instead.
 */

export * from './rbac';
export * from './access';
export * from './credentials';
