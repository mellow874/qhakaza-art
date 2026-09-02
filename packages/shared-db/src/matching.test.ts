import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WEIGHTS,
  profileFromSources,
  rankCollectorsForWork,
  rankWorksForCollector,
  scoreMatch,
  type MatchableCollector,
  type MatchableWork,
} from './matching';

/**
 * Matching.
 *
 * The ranking is deliberately simple, so these test the two things that matter
 * about it: that it never invents a reason, and that it never releases
 * anything. A suggestion an advisor cannot argue with is worse than no
 * suggestion.
 */

const work = (over: Partial<MatchableWork> = {}): MatchableWork => ({
  id: 'w1',
  title: 'A work',
  medium: 'Photography',
  themes: ['memory', 'landscape'],
  artistCountry: 'South Africa',
  ...over,
});

const collector = (over: Partial<MatchableCollector> = {}): MatchableCollector => ({
  membershipId: 'm1',
  name: 'A collector',
  mediums: ['Photography'],
  themes: ['memory'],
  regions: ['South Africa'],
  ...over,
});

describe('scoreMatch', () => {
  it('scores each kind of agreement by its weight', () => {
    const match = scoreMatch(work(), collector());

    // medium 3 + one theme 2 + region 1
    expect(match.score).toBe(
      DEFAULT_WEIGHTS.medium + DEFAULT_WEIGHTS.theme + DEFAULT_WEIGHTS.region,
    );
  });

  it('weighs medium above theme, and theme above region', () => {
    const onlyMedium = scoreMatch(work({ themes: [], artistCountry: null }), collector());
    const onlyTheme = scoreMatch(work({ medium: null, artistCountry: null }), collector());
    const onlyRegion = scoreMatch(work({ medium: null, themes: [] }), collector());

    expect(onlyMedium.score).toBeGreaterThan(onlyTheme.score);
    expect(onlyTheme.score).toBeGreaterThan(onlyRegion.score);
  });

  it('scores nothing when nothing agrees, and says so', () => {
    const match = scoreMatch(
      work({ medium: 'Sculpture', themes: ['industry'], artistCountry: 'Kenya' }),
      collector(),
    );

    expect(match.score).toBe(0);
    expect(match.rationale).toBe('No stated preference in common');
  });

  it('ignores case and stray spacing, because these are typed by people', () => {
    const match = scoreMatch(
      work({ medium: '  photography ', themes: ['MEMORY'], artistCountry: null }),
      collector({ regions: [] }),
    );

    expect(match.overlaps.mediums).toEqual(['photography']);
    expect(match.overlaps.themes).toEqual(['memory']);
  });

  it('explains itself in words an advisor can disagree with', () => {
    const match = scoreMatch(work(), collector());

    expect(match.rationale).toContain('Photography');
    expect(match.rationale).toContain('memory');
  });

  it('never counts the same preference twice', () => {
    const match = scoreMatch(
      work({ themes: ['memory', 'memory', 'Memory'] }),
      collector({ themes: ['memory'] }),
    );

    expect(match.overlaps.themes).toEqual(['memory']);
  });
});

describe('ranking', () => {
  it('puts the closest collector first', () => {
    const close = collector({ membershipId: 'close' });
    const partial = collector({ membershipId: 'partial', themes: [], regions: [] });

    const ranked = rankCollectorsForWork(work(), [partial, close]);

    expect(ranked.map((r) => r.collector.membershipId)).toEqual(['close', 'partial']);
  });

  it('drops candidates with nothing in common rather than listing them', () => {
    // A suggestion with no stated reason is noise, and teaches an advisor to
    // stop reading the list.
    const unrelated = collector({
      membershipId: 'unrelated',
      mediums: ['Sculpture'],
      themes: ['industry'],
      regions: ['Kenya'],
    });

    expect(rankCollectorsForWork(work(), [unrelated])).toEqual([]);
  });

  it('is stable when two candidates tie', () => {
    // An admin returning to the screen should see the same order.
    const a = collector({ membershipId: 'aaa' });
    const b = collector({ membershipId: 'bbb' });

    expect(rankCollectorsForWork(work(), [b, a]).map((r) => r.collector.membershipId)).toEqual([
      'aaa',
      'bbb',
    ]);
  });

  it('ranks works for a collector by the same rules', () => {
    const strong = work({ id: 'strong' });
    const weak = work({ id: 'weak', themes: [], artistCountry: null });

    expect(rankWorksForCollector(collector(), [weak, strong]).map((r) => r.work.id)).toEqual([
      'strong',
      'weak',
    ]);
  });

  it('returns nothing rather than everything for a collector who stated no preferences', () => {
    const blank = collector({ mediums: [], themes: [], regions: [] });

    expect(rankWorksForCollector(blank, [work()])).toEqual([]);
  });
});

describe('profileFromSources', () => {
  it('folds the intake and the note into one shape', () => {
    const profile = profileFromSources({
      intake: {
        preferredMediums: ['Painting'],
        country: 'South Africa',
        collectingGoal: 'Build slowly',
      },
      note: {
        mediums: ['Photography'],
        regions: ['West Africa'],
        subjects: 'memory, migration',
        budgetBand: 'Considered',
        acquisitionPace: 'Slow',
        building: 'A focused collection',
      },
    });

    expect(profile.mediums).toEqual(['Photography', 'Painting']);
    expect(profile.regions).toEqual(['West Africa', 'South Africa']);
    expect(profile.themes).toEqual(['memory', 'migration']);
    expect(profile.sourcedFrom).toBe('intake, private-note');
  });

  it('prefers what the collector said in the note over the form', () => {
    // The Private Note is where someone speaks in their own words; the intake
    // is where they filled in a field.
    const profile = profileFromSources({
      intake: { collectingGoal: 'From the form' },
      note: { building: 'In their own words' },
    });

    expect(profile.motivations).toBe('In their own words');
  });

  it('leaves a field empty rather than guessing at it', () => {
    const profile = profileFromSources({ intake: null, note: null });

    expect(profile.mediums).toEqual([]);
    expect(profile.themes).toEqual([]);
    expect(profile.motivations).toBeNull();
    expect(profile.sourcedFrom).toBeNull();
  });

  it('does not treat an empty subjects line as a theme', () => {
    const profile = profileFromSources({ note: { subjects: '  ,  , ' } });

    expect(profile.themes).toEqual([]);
  });
});
