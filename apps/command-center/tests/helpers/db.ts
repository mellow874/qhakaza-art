import bcrypt from 'bcryptjs';

import { prisma } from '@qhakaza/shared-db';
import type { Role } from '@qhakaza/shared-auth';

/**
 * Wipes every table in foreign-key-safe order. Called before each integration
 * test so they cannot leak state into one another.
 */
export async function resetDb() {
  await prisma.contactMessage.deleteMany();
  await prisma.collectorIntake.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.order.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

let sequence = 0;

/** Creates a user with a unique email so tests never collide. */
export async function makeUser(role: Role, overrides: { name?: string; email?: string } = {}) {
  sequence += 1;

  return prisma.user.create({
    data: {
      name: overrides.name ?? `${role} ${sequence}`,
      email: overrides.email ?? `${role.toLowerCase()}-${sequence}@test.local`,
      role,
      passwordHash: await bcrypt.hash('password123', 4),
    },
  });
}

export async function makeArtistWithProfile(
  overrides: { displayName?: string; slug?: string; approved?: boolean } = {},
) {
  const user = await makeUser('ARTIST');

  const profile = await prisma.artist.create({
    data: {
      userId: user.id,
      displayName: overrides.displayName ?? `Studio ${sequence}`,
      slug: overrides.slug ?? `studio-${sequence}`,
      approved: overrides.approved ?? false,
    },
  });

  return { user, profile };
}
