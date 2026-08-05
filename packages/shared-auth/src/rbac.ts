/**
 * Role-based access rules for the app's route areas.
 *
 * This module is deliberately free of Next.js and Prisma imports so it can be
 * unit-tested in isolation and reused by middleware, server components and
 * server actions alike. Middleware is a convenience fence — every server action
 * re-checks authorisation against the session on the server.
 */

export const ROLES = ['ARTIST', 'COLLECTOR', 'ADMIN', 'ADVISOR'] as const;

export type Role = (typeof ROLES)[number];

/**
 * Roles permitted inside the Command Center. Advisors run matching and
 * concierge work; admins additionally manage permissions and platform data.
 */
export const COMMAND_CENTER_ROLES = ['ADMIN', 'ADVISOR'] as const satisfies readonly Role[];

export function isCommandCentreRole(role: Role | null): boolean {
  return role !== null && (COMMAND_CENTER_ROLES as readonly string[]).includes(role);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Route areas and the roles admitted to each. Everything else is public.
 *
 * A list rather than a single role per area: the Command Center admits both
 * ADMIN and ADVISOR, and collapsing that to one role would have forced a
 * special case at every call site.
 */
const PROTECTED_AREAS = [
  { prefix: '/artist', roles: ['ARTIST'] },
  { prefix: '/collector', roles: ['COLLECTOR'] },
  { prefix: '/admin', roles: COMMAND_CENTER_ROLES },
] as const satisfies ReadonlyArray<{ prefix: string; roles: readonly Role[] }>;

/*
 * `/private` is deliberately NOT listed above.
 *
 * It is gated in the Collector Platform's private layout instead, which
 * validates the invitation token *and* the role. Fencing it here as well would
 * redirect anonymous requests to /login before any code could run — and
 * anonymous requests are precisely the ones worth recording, because that is
 * what token guessing looks like. Enforcement lives where the database is
 * reachable and every attempt can be written to ActivationAttempt.
 *
 * The layout, not the page, holds the gate, so a private route added later is
 * covered whether or not its author remembers to guard it.
 */

/** Matches a path segment boundary, so `/artists` never matches `/artist`. */
function isWithin(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The roles admitted to `pathname`, or null if it is public. */
export function requiredRolesForPath(pathname: string): readonly Role[] | null {
  const area = PROTECTED_AREAS.find(({ prefix }) => isWithin(pathname, prefix));
  return area ? area.roles : null;
}

export function isPublicPath(pathname: string): boolean {
  return requiredRolesForPath(pathname) === null;
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
  const required = requiredRolesForPath(pathname);

  if (required === null) return { allowed: true };
  if (role === null) return { allowed: false, redirectTo: loginRedirect(pathname) };
  if (!required.includes(role)) return { allowed: false, redirectTo: '/forbidden' };

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
    case 'ADVISOR':
      return '/admin';
  }
}
