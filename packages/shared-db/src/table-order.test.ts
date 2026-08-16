import { describe, expect, it } from 'vitest';

import {
  buildDependencyGraph,
  CircularDependencyError,
  normaliseTableName,
  topologicallySort,
} from './table-order';

/**
 * The insertion order for the data migration.
 *
 * These tests exist because the failure they guard against is invisible until
 * a production cutover is already half-finished.
 */

/** Every table appears after everything it depends on. */
function respectsDependencies(order: string[], edges: { child: string; parent: string }[]) {
  return edges.every(({ child, parent }) => {
    if (child === parent) return true;
    return order.indexOf(parent) < order.indexOf(child);
  });
}

describe('topologicallySort', () => {
  it('puts a parent before its child', () => {
    const edges = [{ child: 'Artwork', parent: 'Artist' }];
    const order = topologicallySort(['Artwork', 'Artist'], buildDependencyGraph(edges));

    expect(order).toEqual(['Artist', 'Artwork']);
  });

  it('orders a chain several levels deep', () => {
    // The real shape: intake → membership → invitation → activation attempt.
    const edges = [
      { child: 'Membership', parent: 'CollectorIntake' },
      { child: 'MemberInvitation', parent: 'Membership' },
      { child: 'ActivationAttempt', parent: 'MemberInvitation' },
    ];
    const tables = ['ActivationAttempt', 'MemberInvitation', 'Membership', 'CollectorIntake'];

    expect(topologicallySort(tables, buildDependencyGraph(edges))).toEqual([
      'CollectorIntake',
      'Membership',
      'MemberInvitation',
      'ActivationAttempt',
    ]);
  });

  it('handles a table with two parents', () => {
    const edges = [
      { child: 'Order', parent: 'Artwork' },
      { child: 'Order', parent: 'User' },
    ];
    const order = topologicallySort(['Order', 'Artwork', 'User'], buildDependencyGraph(edges));

    expect(order.indexOf('Order')).toBe(2);
    expect(respectsDependencies(order, edges)).toBe(true);
  });

  it('is deterministic — the same schema always yields the same order', () => {
    // A migration whose order varies between runs cannot be verified against a
    // previous run, so ties are broken alphabetically rather than by Set order.
    const edges = [{ child: 'Artwork', parent: 'Artist' }];
    const tables = ['Zebra', 'Artwork', 'Artist', 'Aardvark'];
    const graph = buildDependencyGraph(edges);

    const first = topologicallySort(tables, graph);
    const second = topologicallySort([...tables].reverse(), graph);

    expect(first).toEqual(second);
    expect(first[0]).toBe('Aardvark');
  });

  it('places independent tables without inventing dependencies', () => {
    const order = topologicallySort(['Partner', 'DailyMetric'], new Map());
    expect(order).toEqual(['DailyMetric', 'Partner']);
  });

  it('tolerates a self-reference rather than calling it a cycle', () => {
    // A column pointing at its own table is satisfied within one insert batch.
    const graph = buildDependencyGraph([{ child: 'Category', parent: 'Category' }]);

    expect(graph.has('Category')).toBe(false);
    expect(topologicallySort(['Category'], graph)).toEqual(['Category']);
  });

  it('ignores a dependency on a table that is not being migrated', () => {
    // Not in the set means not changing, so the constraint is already met.
    const graph = buildDependencyGraph([{ child: 'Artwork', parent: 'SomethingExternal' }]);

    expect(topologicallySort(['Artwork'], graph)).toEqual(['Artwork']);
  });

  it('throws on a genuine cycle instead of emitting a partial order', () => {
    // Silently dropping the tables it could not place would look like success
    // and lose data.
    const graph = buildDependencyGraph([
      { child: 'A', parent: 'B' },
      { child: 'B', parent: 'A' },
    ]);

    expect(() => topologicallySort(['A', 'B'], graph)).toThrow(CircularDependencyError);
    expect(() => topologicallySort(['A', 'B'], graph)).toThrow(/A, B/);
  });

  it('names every table in a longer cycle', () => {
    const graph = buildDependencyGraph([
      { child: 'A', parent: 'B' },
      { child: 'B', parent: 'C' },
      { child: 'C', parent: 'A' },
    ]);

    expect(() => topologicallySort(['A', 'B', 'C'], graph)).toThrow(/A, B, C/);
  });

  it('orders a graph the size of the current schema', () => {
    // 21 tables with the relations this schema actually has, as a regression
    // guard on the whole arrangement rather than one edge at a time.
    const edges = [
      { child: 'Artist', parent: 'User' },
      { child: 'Artwork', parent: 'Artist' },
      { child: 'CollectorVerification', parent: 'CollectorIntake' },
      { child: 'Membership', parent: 'CollectorIntake' },
      { child: 'MemberInvitation', parent: 'Membership' },
      { child: 'ActivationAttempt', parent: 'MemberInvitation' },
      { child: 'PrivateNoteSubmission', parent: 'Artwork' },
      { child: 'Order', parent: 'Artwork' },
      { child: 'Favorite', parent: 'Artwork' },
      { child: 'Account', parent: 'User' },
      { child: 'Session', parent: 'User' },
    ];
    const tables = [
      'User', 'Artist', 'Artwork', 'CollectorIntake', 'CollectorVerification',
      'Membership', 'MemberInvitation', 'ActivationAttempt', 'PrivateNoteSubmission',
      'PrivateNote', 'NewsArticle', 'Partner', 'AnalyticsEvent', 'DailyMetric',
      'AuditLog', 'Order', 'Favorite', 'ContactMessage', 'Account', 'Session',
      'VerificationToken',
    ];

    const order = topologicallySort(tables, buildDependencyGraph(edges));

    expect(order).toHaveLength(tables.length);
    expect(new Set(order)).toEqual(new Set(tables));
    expect(respectsDependencies(order, edges)).toBe(true);
  });
});

describe('normaliseTableName', () => {
  it.each([
    ['public."Artwork"', 'Artwork'],
    ['"Artwork"', 'Artwork'],
    ['Artwork', 'Artwork'],
    ['public.Artwork', 'Artwork'],
  ])('%s → %s', (input, expected) => {
    expect(normaliseTableName(input)).toBe(expected);
  });

  it('treats the quoted and unquoted forms as one table', () => {
    // Postgres returns `regclass` quoted only when the name needs it, so the
    // same table can arrive spelled two ways within one result set.
    const graph = buildDependencyGraph([{ child: 'public."Artwork"', parent: '"Artist"' }]);

    expect(graph.get('Artwork')).toEqual(new Set(['Artist']));
  });
});
