import type { DefaultSession } from 'next-auth';
// Imported purely so the augmentation below can resolve it. In a module file
// TypeScript will not augment a specifier it has not been asked to load, and
// the failure reads as "invalid module name" rather than "add an import".
import type {} from 'next-auth/jwt';

import type { Role } from './rbac';

/**
 * Teaches next-auth that a session carries our role.
 *
 * Lives here rather than in each app: shared-auth is what puts the role on the
 * session, so it is what should describe it. It used to be duplicated in all
 * three apps, which meant `auth.config.ts` — in this package — only typechecked
 * because an *app* happened to declare the shape its own dependency produced.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }

  interface User {
    role?: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role;
  }
}

// A module, so the augmentation above is scoped and loadable by import.
export {};
