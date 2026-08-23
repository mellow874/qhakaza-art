import { auth } from '@qhakaza/shared-auth/server';

import { commandCentreActor, isFailure, readAs } from '@/lib/audit';

/**
 * What the placement panel needs to render.
 *
 * One transaction, like every other Command Center read - the actor is
 * transaction-scoped, so a page's queries have to share one.
 */
export async function getPlacementData() {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { works: [], audiences: [] };

  return readAs(actor, async (tx) => {
    const [works, audiences] = await Promise.all([
      tx.artwork.findMany({
        // Only work that could actually be placed. Showing a draft here would
        // invite an admin to try something the release action refuses.
        where: { status: { in: ['APPROVED', 'COLLECTOR_READY', 'RELEASED_TO_AUDIENCE'] } },
        select: {
          id: true,
          title: true,
          status: true,
          medium: true,
          artist: {
            select: {
              displayName: true,
              permissions: {
                where: { kind: 'SHARE_PRIVATELY_WITH_COLLECTORS', granted: true },
                select: { id: true },
              },
            },
          },
          releases: {
            where: { revokedAt: null },
            select: { id: true, tier: true, audience: { select: { name: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 60,
      }),
      tx.audience.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          _count: { select: { members: { where: { removedAt: null } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      works: works.map((work) => ({
        id: work.id,
        title: work.title,
        status: work.status,
        medium: work.medium || null,
        artist: work.artist.displayName,
        // Surfaced so the panel can say so before an admin tries and is
        // refused. Staff cannot grant this on the artist's behalf.
        artistPermits: work.artist.permissions.length > 0,
        releases: work.releases.map((release) => ({
          id: release.id,
          tier: release.tier,
          audienceName: release.audience.name,
        })),
      })),
      audiences: audiences.map((audience) => ({
        id: audience.id,
        name: audience.name,
        memberCount: audience._count.members,
      })),
    };
  });
}
