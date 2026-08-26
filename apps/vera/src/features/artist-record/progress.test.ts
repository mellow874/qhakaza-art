import { describe, expect, it } from 'vitest';

import { describeProgress, summariseRecord, type RecordShape } from './progress';

/**
 * What an artist is told about their own record.
 *
 * These assertions are about WORDING as much as logic, because this is the
 * only place the platform describes an artist's record back to them and the
 * line between "here is what is missing" and "here is how you are doing" is
 * the line this feature must not cross.
 */

const empty: RecordShape = {
  mediums: [],
  exhibitions: [],
  representations: [],
  cvEntries: [],
  signals: [],
  links: [],
  documents: [],
};

describe('section states', () => {
  it('calls an untouched record empty throughout', () => {
    const sections = summariseRecord(empty);

    expect(sections.every((section) => section.state === 'empty')).toBe(true);
  });

  it('calls the about section started when some of it is filled', () => {
    const sections = summariseRecord({ ...empty, biographyPublic: 'Born in Durban.' });
    const about = sections.find((section) => section.key === 'about');

    expect(about?.state).toBe('started');
    expect(about?.outstanding).toContain('A fuller biography for Qhakaza');
    expect(about?.outstanding).not.toContain('A biography for your public page');
  });

  it('calls the about section complete only when all of it is filled', () => {
    const sections = summariseRecord({
      ...empty,
      biographyPublic: 'a',
      biographyInternal: 'b',
      practice: 'c',
      statement: 'd',
      basedIn: 'e',
    });

    expect(sections.find((section) => section.key === 'about')?.state).toBe('complete');
  });

  it('treats whitespace as not filled in', () => {
    const sections = summariseRecord({ ...empty, biographyPublic: '   ' });

    expect(sections.find((section) => section.key === 'about')?.state).toBe('empty');
  });

  it('calls a list section complete on a single entry', () => {
    /*
     * There is no correct number of exhibitions. An artist early in their
     * career should not be told their record is deficient for having one, so
     * one is enough for the section to count as engaged with.
     */
    const sections = summariseRecord({ ...empty, exhibitions: [{}] });
    const exhibitions = sections.find((section) => section.key === 'exhibitions');

    expect(exhibitions?.state).toBe('complete');
    expect(exhibitions?.count).toBe(1);
    expect(exhibitions?.outstanding).toEqual([]);
  });
});

describe('the summary line', () => {
  it('invites a start rather than reporting a deficit', () => {
    expect(describeProgress(summariseRecord(empty))).toBe(
      'Nothing recorded yet. Start anywhere - it saves as you go.',
    );
  });

  it('counts sections without implying a target', () => {
    const sections = summariseRecord({ ...empty, exhibitions: [{}], links: [{}] });

    expect(describeProgress(sections)).toBe('2 of 8 sections have something in them.');
  });

  it('does not congratulate a full record as though it were finished', () => {
    // A record is never finished; an artist keeps working. The wording says
    // "you can keep adding" rather than "complete".
    const sections = summariseRecord({
      biographyPublic: 'a',
      biographyInternal: 'b',
      practice: 'c',
      statement: 'd',
      basedIn: 'e',
      mediums: [{}],
      exhibitions: [{}],
      representations: [{}],
      cvEntries: [{}],
      signals: [{}],
      links: [{}],
      documents: [{}],
    });

    expect(describeProgress(sections)).toContain('keep adding');
  });
});

describe('nothing here is an assessment', () => {
  it('never produces a score, percentage or rating', () => {
    const sections = summariseRecord({ ...empty, exhibitions: [{}] });
    const serialised = JSON.stringify(sections) + describeProgress(sections);

    // Readiness is Qhakaza's, is never shown to the artist, and must not be
    // approximated here by a number that looks like one.
    expect(serialised).not.toMatch(/%|score|rating|readiness|ready/i);
  });
});
