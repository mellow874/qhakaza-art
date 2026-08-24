import type { Metadata } from 'next';

import { privateNote } from '@/content/private-note';
import { AmbientAudio } from '@/features/private-note/ambient-audio';
import { submitPrivateNote } from '@/features/private-note/actions';
import { PrivateNoteForm } from '@/features/private-note/private-note-form';

/**
 * The Private Note — a standalone RSVP for prospective collectors.
 *
 * Its own route, not a step inside the intake: it is offered alongside the
 * journey rather than inside it, and someone can write one without applying for
 * anything.
 *
 * Lives under `/collectors/` (the public shell) rather than `/private/`, which
 * is the invite-only token-gated tree. A prospective collector has no token, so
 * putting it there would make it unreachable by the people it is for.
 */
export const metadata: Metadata = {
  title: 'The Private Note',
  description: privateNote.lede,
  // Personal answers, reached by invitation or from the journey — not a page
  // that should turn up in a search result.
  robots: { index: false, follow: false },
};

export default function PrivateNotePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-24 sm:py-28">
      <p className="eyebrow">{privateNote.eyebrow}</p>
      <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl">{privateNote.title}</h1>
      <p className="text-body mt-8 max-w-2xl text-lg leading-relaxed">{privateNote.lede}</p>
      <p className="text-muted mt-4 max-w-2xl text-sm italic">{privateNote.aside}</p>

      <div className="mt-12 max-w-2xl">
        <AmbientAudio />
      </div>

      <hr className="border-line/70 mt-16" />

      <div className="mt-16">
        <PrivateNoteForm onSubmit={submitPrivateNote} />
      </div>
    </main>
  );
}
