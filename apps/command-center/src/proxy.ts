import NextAuth from 'next-auth';

import { applyAccessRules, roleFromSession } from '@qhakaza/shared-auth';
import { authConfig } from '@qhakaza/shared-auth/auth.config';

/**
 * Route fencing at the edge. (Next.js 16 renamed the `middleware` file
 * convention to `proxy`; the contract is unchanged.)
 *
 * This is a fast first line of defence, not the only one — every server action
 * and server component re-checks authorisation against the session, because
 * middleware alone can be bypassed by direct data-layer access.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => applyAccessRules(req.nextUrl, roleFromSession(req.auth)));

export const config = {
  // Everything except Next internals, the auth endpoints and static assets.
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
};
