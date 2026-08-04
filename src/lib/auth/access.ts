import { NextResponse } from 'next/server';

import { authorize, isRole, type Role } from './rbac';

/** Narrows whatever the session callback produced down to a known role. */
export function roleFromSession(session: unknown): Role | null {
  if (!session || typeof session !== 'object') return null;

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== 'object') return null;

  const role = (user as { role?: unknown }).role;
  return isRole(role) ? role : null;
}

/** Turns an authorisation decision into the response middleware should return. */
export function applyAccessRules(url: URL, role: Role | null): NextResponse {
  const result = authorize({ pathname: url.pathname, role });

  if (result.allowed) return NextResponse.next();

  // Resolved against `url` so the redirect never leaves this origin.
  return NextResponse.redirect(new URL(result.redirectTo, url));
}
