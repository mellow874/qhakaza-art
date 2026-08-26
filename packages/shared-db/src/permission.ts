import type { Prisma } from '@prisma/client';

/**
 * The permission conflict rule, as a Prisma predicate.
 *
 * THE RULE: MORE RESTRICTIVE WINS. A permission holds only if some applicable
 * row grants it AND no applicable row denies it. A row applies when it is
 * artist-wide (`artworkId` null) or names this particular work.
 *
 * WHY THIS FILE EXISTS AT ALL. The rule was previously written out by hand in
 * three places - the two SQL visibility functions and two app queries - and all
 * of them got it wrong the same way: they tested `EXISTS(granted = true)` and
 * never looked at denials, so an artist-wide grant silently overrode a
 * work-specific refusal. Four copies of a rule is four chances to write it
 * wrongly, so there is now one copy here and one in
 * `qhakaza_permission_granted()`, and `permission.db.test.ts` asserts the two
 * agree on every combination rather than trusting that they do.
 *
 * The database function is the control; this predicate exists so the intent is
 * readable at the call site and so a query returns the right rows rather than
 * relying on RLS to strip them afterwards.
 *
 * EXPIRY IS NOT DENIAL. An expired grant stops counting as a grant and takes
 * no part in the denial test - permission lapses, rather than the artist being
 * recorded as having refused. Denials are not given an expiry.
 */
export function artworkPermissionGranted(
  kind: Prisma.ArtistPermissionWhereInput['kind'],
  now: Date = new Date(),
): Prisma.ArtworkWhereInput {
  const unexpired = { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };

  return {
    AND: [
      // Granted, by a row that applies here: this work specifically, or the
      // artist's material as a whole.
      {
        OR: [
          { permissions: { some: { kind, granted: true, ...unexpired } } },
          {
            artist: {
              permissions: { some: { kind, granted: true, artworkId: null, ...unexpired } },
            },
          },
        ],
      },
      // And denied by nothing that applies here. These two clauses are the
      // whole of the fix: without them a general grant answered for a specific
      // refusal.
      { permissions: { none: { kind, granted: false } } },
      { artist: { permissions: { none: { kind, granted: false, artworkId: null } } } },
    ],
  };
}

/** The three fields the rule actually depends on. */
export type PermissionRow = {
  artworkId: string | null;
  granted: boolean;
  expiresAt?: Date | null;
};

/**
 * The rule again, this time over rows already in hand.
 *
 * For code that has fetched an artist's permissions and must decide - the
 * release action, and the admin screens that explain why a release was
 * refused. A pure function so it can be tested exhaustively without a
 * database, which is how the inverted precedence would have been caught the
 * first time.
 *
 * Pass every row for the artist and the kind in question. Passing a
 * pre-filtered set is the mistake that caused the original defect: filtering
 * to `granted: true` before deciding removes exactly the rows that decide.
 */
export function decidePermission(
  rows: PermissionRow[],
  artworkId: string | null,
  now: Date = new Date(),
): boolean {
  const applies = (row: PermissionRow) =>
    row.artworkId === null || (artworkId !== null && row.artworkId === artworkId);

  const live = (row: PermissionRow) => !row.expiresAt || row.expiresAt > now;

  const applicable = rows.filter(applies);

  // One denial anywhere is a denial. Checked first because it is the half that
  // used to be missing.
  if (applicable.some((row) => !row.granted)) return false;

  return applicable.some((row) => row.granted && live(row));
}

/**
 * The same rule for a question asked about an artist rather than a work.
 *
 * Only artist-wide rows are consulted. A permission granted for one artwork
 * says nothing about the artist's material in general, and treating it as
 * though it did is how a narrow consent becomes a broad one.
 */
export function artistPermissionGranted(
  kind: Prisma.ArtistPermissionWhereInput['kind'],
  now: Date = new Date(),
): Prisma.ArtistWhereInput {
  return {
    AND: [
      {
        permissions: {
          some: {
            kind,
            granted: true,
            artworkId: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
      },
      { permissions: { none: { kind, granted: false, artworkId: null } } },
    ],
  };
}
