import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CORE_ENTITIES } from './entities';
import { policyExpression, RLS_MATRIX, type EntityPolicy, type Operation } from './rls';

/**
 * Adversarial RLS tests.
 *
 * These deliberately connect as **qhakaza_app** — the non-owner, non-superuser,
 * NOBYPASSRLS role the applications use. Running them on the owner connection
 * would pass while proving nothing, because the owner bypasses every policy.
 * That is the trap this whole phase exists to avoid, so the connection is
 * asserted before anything else runs.
 */

const OWNER_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://qhakaza:qhakaza@localhost:5433/qhakaza_art_test?schema=public';
const APP_URL = OWNER_URL.replace('qhakaza:qhakaza@', 'qhakaza_app:qhakaza_app@');

const owner = new PrismaClient({ datasourceUrl: OWNER_URL });
const app = new PrismaClient({ datasourceUrl: APP_URL });

/** Runs `sql` as the app role, with the actor declared for the transaction. */
async function as<T>(
  role: string,
  userId: string | null,
  run: (tx: Parameters<Parameters<typeof app.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return app.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('qhakaza.role', ${role}, true), set_config('qhakaza.user_id', ${userId ?? ''}, true)`;
    return run(tx);
  });
}

/** Anonymous: no actor declared at all. */
function anonymously<T>(run: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return run(app);
}

/**
 * `findMany` on a model named at runtime.
 *
 * The tables differ in shape, so a table-driven test cannot share one typed
 * callback. Narrowed to the one method these tests use rather than casting the
 * whole client to `any`.
 */
function findMany(client: unknown, model: string): Promise<unknown[]> {
  return (client as Record<string, { findMany: () => Promise<unknown[]> }>)[model].findMany();
}

let artistUserId: string;
let otherArtistUserId: string;
let collectorUserId: string;

beforeAll(async () => {
  // Seeded as the owner, which bypasses RLS — otherwise the fixtures could not
  // be created, and the test would be measuring its own setup.
  await owner.privateNoteSubmission.deleteMany();
  await owner.auditLog.deleteMany();
  await owner.memberInvitation.deleteMany();
  await owner.membership.deleteMany();
  await owner.collectorVerification.deleteMany();
  await owner.collectorIntake.deleteMany();
  await owner.artwork.deleteMany();
  await owner.artist.deleteMany();
  await owner.user.deleteMany();

  const artistUser = await owner.user.create({
    data: { email: 'rls-artist@test.local', role: 'ARTIST' },
  });
  const otherUser = await owner.user.create({
    data: { email: 'rls-other@test.local', role: 'ARTIST' },
  });
  const collectorUser = await owner.user.create({
    data: { email: 'rls-collector@test.local', role: 'COLLECTOR' },
  });
  artistUserId = artistUser.id;
  otherArtistUserId = otherUser.id;
  collectorUserId = collectorUser.id;

  const mine = await owner.artist.create({
    data: { userId: artistUser.id, displayName: 'Mine', slug: 'rls-mine', approved: false },
  });
  const theirs = await owner.artist.create({
    data: { userId: otherUser.id, displayName: 'Theirs', slug: 'rls-theirs', approved: true },
  });

  await owner.artwork.create({
    data: {
      artistId: mine.id,
      title: 'My Draft',
      description: 'x',
      images: [],
      medium: 'Oil',
      dimensions: '1x1',
      price: '100',
      status: 'DRAFT',
    },
  });
  await owner.artwork.create({
    data: {
      artistId: theirs.id,
      title: 'Their Released Work',
      description: 'x',
      images: [],
      medium: 'Oil',
      dimensions: '1x1',
      price: '100',
      status: 'LISTED',
    },
  });

  await owner.collectorIntake.create({
    data: { fullName: 'Private Applicant', email: 'applicant@test.local' },
  });
  await owner.memberInvitation.create({
    data: {
      email: 'invitee@test.local',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  await owner.auditLog.create({
    data: { action: 'test.seed', entityType: 'Test', summary: 'seeded' },
  });
});

afterAll(async () => {
  await owner.$disconnect();
  await app.$disconnect();
});

describe('the app connection is actually constrained', () => {
  it('connects as a role that cannot bypass RLS', async () => {
    // If this ever fails, every other test in this file becomes meaningless.
    const [me] = await app.$queryRawUnsafe<{ u: string }[]>('select current_user as u');
    expect(me.u).toBe('qhakaza_app');

    const [flags] = await app.$queryRawUnsafe<{ rolsuper: boolean; rolbypassrls: boolean }[]>(
      `select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );
    expect(flags.rolsuper).toBe(false);
    expect(flags.rolbypassrls).toBe(false);
  });

  it('has RLS enabled on all 13 core entities', async () => {
    const rows = await app.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean }[]>(
      `select c.relname, c.relrowsecurity from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    const enabled = new Set(rows.filter((r) => r.relrowsecurity).map((r) => r.relname));
    for (const entity of CORE_ENTITIES) expect(enabled.has(entity), entity).toBe(true);
  });

  it('has a live policy for every entity and operation in the matrix', async () => {
    // Catches a matrix edit that was never regenerated and applied.
    const rows = await app.$queryRawUnsafe<{ tablename: string; policyname: string }[]>(
      `select tablename, policyname from pg_policies where schemaname = 'public'`,
    );
    const live = new Set(rows.map((r) => `${r.tablename}.${r.policyname}`));

    for (const entity of CORE_ENTITIES) {
      for (const operation of ['select', 'insert', 'update', 'delete'] as Operation[]) {
        expect(
          live.has(`${entity}.${entity.toLowerCase()}_${operation}`),
          `${entity}.${operation}`,
        ).toBe(true);
      }
    }
  });

  it('declares a deny for every operation the matrix does not grant', async () => {
    for (const entity of CORE_ENTITIES) {
      for (const operation of ['select', 'insert', 'update', 'delete'] as Operation[]) {
        const grants = (RLS_MATRIX[entity] as EntityPolicy)[operation] ?? {};
        if (Object.keys(grants).length === 0) {
          // An explicit `false` policy, not merely an absent one.
          expect(policyExpression(entity, operation), `${entity}.${operation}`).toBeNull();
        }
      }
    }
  });
});

describe('an artist cannot reach the collector side', () => {
  it.each([
    'collectorIntake',
    'memberInvitation',
    'membership',
    'collectorVerification',
    'privateNoteSubmission',
  ] as const)('reads nothing from %s', async (model) => {
    const rows = await as('artist', artistUserId, (tx) => findMany(tx, model));
    // RLS filters rather than errors on SELECT: the correct outcome is that the
    // rows are simply not there.
    expect(rows).toEqual([]);
  });

  it('cannot write a CollectorIntake decision', async () => {
    await expect(
      as('artist', artistUserId, (tx) =>
        tx.collectorVerification.create({
          data: { intakeId: 'anything', outcome: 'VERIFIED' },
        }),
      ),
    ).rejects.toThrow();
  });

  it('cannot forge an audit entry', async () => {
    await expect(
      as('artist', artistUserId, (tx) =>
        tx.auditLog.create({ data: { action: 'forged', entityType: 'Artist' } }),
      ),
    ).rejects.toThrow();
  });

  it('sees its own unapproved work but not another artist’s drafts', async () => {
    const titles = await as('artist', artistUserId, async (tx) =>
      (await tx.artwork.findMany({ select: { title: true } })).map((w) => w.title),
    );

    expect(titles).toContain('My Draft');
    expect(titles).not.toContain('Their Released Work');
  });
});

describe('a collector sees only released work and their own records', () => {
  it('sees released work but never a draft', async () => {
    const titles = await as('collector', collectorUserId, async (tx) =>
      (await tx.artwork.findMany({ select: { title: true } })).map((w) => w.title),
    );

    expect(titles).toEqual(['Their Released Work']);
  });

  it('cannot read collector intakes, including anyone else’s', async () => {
    const rows = await as('collector', collectorUserId, (tx) => tx.collectorIntake.findMany());
    expect(rows).toEqual([]);
  });

  it('cannot read invitations', async () => {
    const rows = await as('collector', collectorUserId, (tx) => tx.memberInvitation.findMany());
    expect(rows).toEqual([]);
  });

  it('cannot perform an admin action', async () => {
    await expect(
      as('collector', collectorUserId, (tx) =>
        tx.artist.update({ where: { userId: otherArtistUserId }, data: { approved: false } }),
      ),
    ).rejects.toThrow();
  });

  it('cannot read the audit trail', async () => {
    const rows = await as('collector', collectorUserId, (tx) => tx.auditLog.findMany());
    expect(rows).toEqual([]);
  });
});

describe('anonymous', () => {
  it('sees released work and approved artists only', async () => {
    const titles = await anonymously(async (client) =>
      (await client.artwork.findMany({ select: { title: true } })).map((w) => w.title),
    );
    expect(titles).toEqual(['Their Released Work']);

    const names = await anonymously(async (client) =>
      (await client.artist.findMany({ select: { displayName: true } })).map((a) => a.displayName),
    );
    expect(names).toEqual(['Theirs']);
  });

  it.each(['collectorIntake', 'memberInvitation', 'membership', 'auditLog'] as const)(
    'reads nothing from %s',
    async (model) => {
      const rows = await anonymously((client) => findMany(client, model));
      expect(rows).toEqual([]);
    },
  );

  it('may submit an intake — the one deliberate anonymous write', async () => {
    const email = `walkin-${Date.now()}@test.local`;

    /*
     * `createMany`, not `create`.
     *
     * Prisma's `create()` issues INSERT ... RETURNING, and RETURNING needs
     * SELECT permission on the new row. CollectorIntake is write-only for the
     * public by design, so `create()` inserts successfully and is then refused
     * the read-back — surfacing as "new row violates row-level security
     * policy", which points at the wrong thing entirely.
     *
     * Any genuinely write-only table has to be written this way.
     */
    const result = await anonymously((client) =>
      client.collectorIntake.createMany({ data: [{ fullName: 'Walk-in', email }] }),
    );
    expect(result.count).toBe(1);

    // ...and still cannot read it back. Write-only means write-only.
    expect(await anonymously((client) => client.collectorIntake.findMany())).toEqual([]);

    // Visible to the owner, so the row really was written.
    expect(await owner.collectorIntake.count({ where: { email } })).toBe(1);
    await owner.collectorIntake.deleteMany({ where: { email } });
  });

  it('cannot read an invitation, but the system context can', async () => {
    expect(await anonymously((client) => client.memberInvitation.findMany())).toEqual([]);

    // The door has to validate a token before any actor exists.
    const rows = await as('system', null, (tx) => tx.memberInvitation.findMany());
    expect(rows).toHaveLength(1);
  });
});

describe('the audit trail is append-only for everyone', () => {
  it('lets an admin read and insert', async () => {
    const rows = await as('admin', 'admin-1', (tx) => tx.auditLog.findMany());
    expect(rows.length).toBeGreaterThan(0);

    const created = await as('admin', 'admin-1', (tx) =>
      tx.auditLog.create({ data: { action: 'test.insert', entityType: 'Test' } }),
    );
    expect(created.id).toBeTruthy();
  });

  it.each([
    ['admin', 'admin-1'],
    ['advisor', 'advisor-1'],
  ])('refuses UPDATE by %s', async (role, uid) => {
    // Not even an administrator. A trail the administrator can rewrite is not a
    // trail.
    const target = await owner.auditLog.findFirstOrThrow();
    await expect(
      as(role, uid, (tx) =>
        tx.auditLog.update({ where: { id: target.id }, data: { summary: 'rewritten' } }),
      ),
    ).rejects.toThrow();
  });

  it('refuses DELETE by an admin', async () => {
    const target = await owner.auditLog.findFirstOrThrow();
    await expect(
      as('admin', 'admin-1', (tx) => tx.auditLog.delete({ where: { id: target.id } })),
    ).rejects.toThrow();

    expect(await owner.auditLog.count({ where: { id: target.id } })).toBe(1);
  });
});

describe('an advisor has reach without being an administrator', () => {
  it('reads collector intakes', async () => {
    const rows = await as('advisor', 'advisor-1', (tx) => tx.collectorIntake.findMany());
    expect(rows.length).toBeGreaterThan(0);
  });

  it('cannot delete an artist', async () => {
    await expect(
      as('advisor', 'advisor-1', (tx) =>
        tx.artist.delete({ where: { userId: otherArtistUserId } }),
      ),
    ).rejects.toThrow();
  });
});
