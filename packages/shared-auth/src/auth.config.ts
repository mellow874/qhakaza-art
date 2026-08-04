import Google from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';

import { isRole } from './rbac';

/**
 * Edge-safe slice of the Auth.js config.
 *
 * Middleware runs on the edge runtime, where Prisma cannot go. This file holds
 * only what middleware needs (JWT decoding, session shape). The database
 * adapter and the credentials provider are added in `./index.ts`, which runs
 * on Node only.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    /**
     * The role is the authorisation fact the whole app depends on, so it is
     * copied onto the token at sign-in and read back out on every request.
     */
    jwt({ token, user }) {
      if (user && isRole((user as { role?: unknown }).role)) {
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (isRole(token.role)) session.user.role = token.role;
        if (typeof token.sub === 'string') session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
