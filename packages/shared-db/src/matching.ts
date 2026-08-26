/**
 * Matching work to collectors, and collectors to work.
 *
 * THE SYSTEM SUGGESTS. IT NEVER RELEASES. Nothing here writes an
 * ArtworkRelease. These functions rank candidates and explain why; an admin
 * decides. That separation is the point of the brief's "the admin decides -
 * the system suggests, it never auto-releases", and it is why the scoring is
 * allowed to be simple.
 *
 * THE SCORE IS AN ORDERING, NOT A MEASUREMENT. It is never shown as a
 * percentage or a confidence, because it is neither. Two works scoring 6 and 3
 * mean "look at this one first", not "twice as suitable".
 *
 * The ranking is deliberately legible rather than clever. An advisor has to be
 * able to read the rationale and disagree with it, which rules out anything
 * whose reasoning cannot be written in a sentence.
 */

export type MatchWeights = {
  medium: number;
  theme: number;
  region: number;
};

/**
 * How much each kind of agreement counts.
 *
 * Medium outranks theme, and theme outranks region: a collector who says
 * "photography" is stating something firmer about what they will live with
 * than one who says "South Africa". These are Qhakaza's to revise - they are
 * a starting point, not a finding.
 */
export const DEFAULT_WEIGHTS: MatchWeights = {
  medium: 3,
  theme: 2,
  region: 1,
};

export type MatchableWork = {
  id: string;
  title: string;
  medium: string | null;
  themes: string[];
  artistCountry?: string | null;
};

export type MatchableCollector = {
  membershipId: string;
  name: string | null;
  mediums: string[];
  themes: string[];
  regions: string[];
};

export type Match = {
  score: number;
  /** Why this pairing surfaced, in words an advisor can weigh. */
  rationale: string;
  /** What agreed, so a caller can show it without re-deriving it. */
  overlaps: { mediums: string[]; themes: string[]; regions: string[] };
};

/** Case- and whitespace-insensitive, because these are human-typed lists. */
function normalise(values: readonly (string | null | undefined)[]): string[] {
  return values
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim().toLowerCase());
}

function overlap(
  a: readonly (string | null | undefined)[],
  b: readonly (string | null | undefined)[],
) {
  const right = new Set(normalise(b));
  return [...new Set(normalise(a))].filter((value) => right.has(value));
}

/**
 * Score one work against one collector.
 *
 * Returns a score of zero when nothing agrees. A caller should drop those
 * rather than show them: a suggestion with no stated reason is noise, and it
 * teaches an advisor to stop reading the list.
 */
export function scoreMatch(
  work: MatchableWork,
  collector: MatchableCollector,
  weights: MatchWeights = DEFAULT_WEIGHTS,
): Match {
  const mediums = overlap(work.medium ? [work.medium] : [], collector.mediums);
  const themes = overlap(work.themes, collector.themes);
  const regions = overlap(work.artistCountry ? [work.artistCountry] : [], collector.regions);

  const score =
    mediums.length * weights.medium +
    themes.length * weights.theme +
    regions.length * weights.region;

  const reasons: string[] = [];
  if (mediums.length) reasons.push(`works in ${work.medium}, which they collect`);
  if (themes.length) reasons.push(`themes they follow: ${themes.join(', ')}`);
  if (regions.length) reasons.push(`from a region they favour`);

  return {
    score,
    rationale: reasons.length ? reasons.join('; ') : 'No stated preference in common',
    overlaps: { mediums, themes, regions },
  };
}

/** Collectors who might suit a work, best first, with nothing unexplained. */
export function rankCollectorsForWork(
  work: MatchableWork,
  collectors: readonly MatchableCollector[],
  weights: MatchWeights = DEFAULT_WEIGHTS,
): (Match & { collector: MatchableCollector })[] {
  return collectors
    .map((collector) => ({ ...scoreMatch(work, collector, weights), collector }))
    .filter((match) => match.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.collector.membershipId.localeCompare(b.collector.membershipId),
    );
}

/** Work that might suit a collector, best first. */
export function rankWorksForCollector(
  collector: MatchableCollector,
  works: readonly MatchableWork[],
  weights: MatchWeights = DEFAULT_WEIGHTS,
): (Match & { work: MatchableWork })[] {
  return works
    .map((work) => ({ ...scoreMatch(work, collector, weights), work }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.work.id.localeCompare(b.work.id));
}

/**
 * Build a collector profile from what they have already told us.
 *
 * The intake and the Private Note both hold preference data, in different
 * words. This folds them into one shape without inventing anything: a field
 * neither supplied stays empty rather than being guessed at.
 */
export function profileFromSources(input: {
  intake?: {
    preferredMediums?: string[];
    country?: string | null;
    collectingGoal?: string | null;
  } | null;
  note?: {
    mediums?: string[];
    regions?: string[];
    subjects?: string | null;
    budgetBand?: string | null;
    acquisitionPace?: string | null;
    building?: string | null;
  } | null;
}) {
  const sources: string[] = [];
  if (input.intake) sources.push('intake');
  if (input.note) sources.push('private-note');

  // Subjects arrive as one free-text line; split on commas, keep their words.
  const themes = (input.note?.subjects ?? '')
    .split(',')
    .map((theme) => theme.trim())
    .filter(Boolean);

  return {
    mediums: [
      ...new Set([...(input.note?.mediums ?? []), ...(input.intake?.preferredMediums ?? [])]),
    ],
    regions: [
      ...new Set([
        ...(input.note?.regions ?? []),
        ...(input.intake?.country ? [input.intake.country] : []),
      ]),
    ],
    themes,
    motivations: input.note?.building ?? input.intake?.collectingGoal ?? null,
    budgetLogic: input.note?.budgetBand ?? null,
    acquisitionPace: input.note?.acquisitionPace ?? null,
    sourcedFrom: sources.join(', ') || null,
  };
}
