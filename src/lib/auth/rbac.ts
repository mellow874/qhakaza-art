/**
 * Role-based access rules for the app's route areas.
 *
 * This module is deliberately free of Next.js and Prisma imports so it can be
 * unit-tested in isolation and reused by middleware, server components and
 * server actions alike. Middleware is a convenience fence — every server action
 * re-checks authorisation against the session on the server.
 */

export const ROLES = ['ARTIST', 'COLLECTOR', 'ADMIN'] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Route areas fenced to a single role. Everything else is public. */
const PROTECTED_AREAS = [
  { prefix: '/artist', role: 'ARTIST' },
  { prefix: '/collector', role: 'COLLECTOR' },
  { prefix: '/admin', role: 'ADMIN' },
] as const satisfies ReadonlyArray<{ prefix: string; role: Role }>;

/** Matches a path segment boundary, so `/artists` never matches `/artist`. */
function isWithin(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function requiredRoleForPath(pathname: string): Role | null {
  const area = PROTECTED_AREAS.find(({ prefix }) => isWithin(pathname, prefix));
  return area ? area.role : null;
}

export function isPublicPath(pathname: string): boolean {
  return requiredRoleForPath(pathname) === null;
}

export function loginRedirect(pathname: string): string {
  return `/login?callbackUrl=${encodeURIComponent(pathname)}`;
}

export type AuthorizeResult = { allowed: true } | { allowed: false; redirectTo: string };

/**
 * Decides whether a session holding `role` may view `pathname`.
 *
 * ADMIN is intentionally not a superuser over the other areas: admins oversee
 * the platform through `/admin`, they do not act inside artist or collector
 * surfaces. Widening that is a product decision, not a default.
 */
export function authorize({
  pathname,
  role,
}: {
  pathname: string;
  role: Role | null;
}): AuthorizeResult {
  const required = requiredRoleForPath(pathname);

  if (required === null) return { allowed: true };
  if (role === null) return { allowed: false, redirectTo: loginRedirect(pathname) };
  if (role !== required) return { allowed: false, redirectTo: '/forbidden' };

  return { allowed: true };
}

/** Where a freshly authenticated user lands when no callback URL was supplied. */
export function homePathForRole(role: Role): string {
  switch (role) {
    case 'ARTIST':
      return '/artist/dashboard';
    case 'COLLECTOR':
      return '/collector/favourites';
    case 'ADMIN':
      return '/admin';
  }
}
