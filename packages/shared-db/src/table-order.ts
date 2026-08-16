/**
 * Work out a safe insertion order for a set of tables.
 *
 * Rows must be inserted parents-first or foreign keys reject them. Pulled out
 * of `scripts/migrate-data.ts` so it can be tested: it is the one piece of the
 * data migration whose failure mode is subtle. A wrong order does not throw at
 * startup — it fails partway through a production cutover, which is the worst
 * possible moment to discover it.
 */

/** `child table → the tables it must be inserted after`. */
export type DependencyGraph = Map<string, Set<string>>;

export class CircularDependencyError extends Error {
  constructor(readonly tables: string[]) {
    super(
      `Circular foreign keys between: ${tables.join(', ')}\n` +
        'Order these by hand — the migration will not guess.',
    );
    this.name = 'CircularDependencyError';
  }
}

/**
 * Kahn's algorithm.
 *
 * Ties are broken alphabetically so two runs over the same schema produce the
 * same order — a migration you cannot reproduce is one you cannot verify.
 *
 * Throws `CircularDependencyError` rather than emitting a partial order: a
 * migration that silently skips the tables it could not place would look like
 * it succeeded.
 */
export function topologicallySort(
  tables: readonly string[],
  dependencies: DependencyGraph,
): string[] {
  const remaining = new Set(tables);
  const ordered: string[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((table) => {
        const needs = dependencies.get(table);
        if (!needs) return true;
        // A dependency on a table outside this set is already satisfied —
        // it is not being migrated, so it is not going to change.
        return [...needs].every((parent) => !remaining.has(parent));
      })
      .sort();

    if (ready.length === 0) throw new CircularDependencyError([...remaining].sort());

    for (const table of ready) {
      ordered.push(table);
      remaining.delete(table);
    }
  }

  return ordered;
}

/**
 * Build the graph from `pg_constraint` rows.
 *
 * Self-references are dropped: a column pointing at its own table is satisfied
 * within a single insert batch and would otherwise look like a cycle of one.
 */
export function buildDependencyGraph(
  edges: readonly { child: string; parent: string }[],
): DependencyGraph {
  const graph: DependencyGraph = new Map();

  for (const { child, parent } of edges) {
    const c = normaliseTableName(child);
    const p = normaliseTableName(parent);
    if (c === p) continue;

    if (!graph.has(c)) graph.set(c, new Set());
    graph.get(c)!.add(p);
  }

  return graph;
}

/** `public."Artwork"` and `"Artwork"` and `Artwork` are the same table. */
export function normaliseTableName(name: string): string {
  return name.replace(/^public\./, '').replace(/"/g, '');
}
