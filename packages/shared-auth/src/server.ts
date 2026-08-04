import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { prisma } from '@qhakaza/shared-db';
import { credentialsSchema } from './credentials';

import { authConfig } from './auth.config';

/**
 * Full server-side Auth.js instance: the edge-safe config plus the Prisma
 * adapter and the credentials provider (both Node-only).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        // Google-only accounts have no passwordHash and must not fall through.
        if (!user?.passwordHash) return null;

        const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!matches) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar,
          role: user.role,
        };
      },
    }),
  ],
});

export { authConfig } from './auth.config';
export * from './rbac';
