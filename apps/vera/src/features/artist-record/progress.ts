/**
 * How far along an artist's record is.
 *
 * WHAT THIS IS NOT: a score, a rating, or anything to do with readiness.
 * Readiness is Qhakaza's assessment against their own framework and is never
 * visible to the artist. This is only "have you filled this section in", which
 * the artist can see for themselves by looking at it - the point is to save
 * them the looking, not to judge the contents.
 *
 * Kept as a pure function so the wording of "started" versus "complete" is
 * testable without a database or a browser. It drives what the artist reads
 * about their own record, so it is worth being sure about.
 */

export type SectionState = 'empty' | 'started' | 'complete';

export type SectionSummary = {
  key: string;
  label: string;
  state: SectionState;
  /** What is missing, in the artist's terms. Empty when complete. */
  outstanding: string[];
  count?: number;
};

export type RecordShape = {
  biographyPublic?: string | null;
  biographyInternal?: string | null;
  practice?: string | null;
  statement?: string | null;
  basedIn?: string | null;
  mediums: unknown[];
  exhibitions: unknown[];
  representations: unknown[];
  cvEntries: unknown[];
  signals: unknown[];
  links: unknown[];
  documents: unknown[];
};

const filled = (value?: string | null) => typeof value === 'string' && value.trim().length > 0;

/**
 * A list section is 'complete' as soon as it has one entry.
 *
 * DELIBERATELY NOT A TARGET NUMBER. There is no correct number of exhibitions,
 * and an artist early in their career being told their record is "40% complete"
 * because they have two rather than five would be both meaningless and
 * discouraging. One entry means the section has been engaged with; the rest is
 * the artist's business.
 */
function listSection(
  key: string,
  label: string,
  entries: unknown[],
  emptyPrompt: string,
): SectionSummary {
  return {
    key,
    label,
    count: entries.length,
    state: entries.length > 0 ? 'complete' : 'empty',
    outstanding: entries.length > 0 ? [] : [emptyPrompt],
  };
}

export function summariseRecord(record: RecordShape): SectionSummary[] {
  const aboutOutstanding: string[] = [];
  if (!filled(record.biographyPublic)) aboutOutstanding.push('A biography for your public page');
  if (!filled(record.biographyInternal)) aboutOutstanding.push('A fuller biography for Qhakaza');
  if (!filled(record.practice)) aboutOutstanding.push('A description of your practice');
  if (!filled(record.statement)) aboutOutstanding.push('Your artist statement');
  if (!filled(record.basedIn)) aboutOutstanding.push('Where you are based');

  const aboutFilledCount = 5 - aboutOutstanding.length;

  return [
    {
      key: 'about',
      label: 'About you',
      state:
        aboutOutstanding.length === 0 ? 'complete' : aboutFilledCount > 0 ? 'started' : 'empty',
      outstanding: aboutOutstanding,
    },
    listSection('mediums', 'What you work in', record.mediums, 'The media you work in'),
    listSection('exhibitions', 'Exhibitions', record.exhibitions, 'Where your work has been shown'),
    listSection(
      'representation',
      'Representation',
      record.representations,
      'Any gallery or agent who represents you',
    ),
    listSection(
      'cv',
      'Curriculum vitae',
      record.cvEntries,
      'Your education, awards and residencies',
    ),
    listSection(
      'signals',
      'Recognition',
      record.signals,
      'Acquisitions, prizes, residencies and commissions',
    ),
    listSection(
      'links',
      'Elsewhere',
      record.links,
      'Your website and other places your work appears',
    ),
    listSection(
      'documents',
      'Documents',
      record.documents,
      'Certificates, catalogues and anything supporting the above',
    ),
  ];
}

/**
 * One sentence for the top of the page.
 *
 * Phrased as an invitation rather than a warning. An incomplete record is the
 * normal state of a record someone is still filling in, and the platform
 * should not imply the artist is behind on something.
 */
export function describeProgress(sections: SectionSummary[]): string {
  const done = sections.filter((section) => section.state === 'complete').length;

  if (done === 0) return 'Nothing recorded yet. Start anywhere - it saves as you go.';
  if (done === sections.length) return 'Every section has something in it. You can keep adding.';

  return `${done} of ${sections.length} sections have something in them.`;
}
