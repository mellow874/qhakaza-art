import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { NarrowPage, PageHeader } from '@/components/page-shell';
import { getMyStudio, submitArtwork } from '@/features/artwork/actions';
import { ArtworkForm } from '@/features/artwork/artwork-form';

export const metadata: Metadata = { title: 'Add a work' };

export default async function NewArtworkPage() {
  const studio = await getMyStudio();
  if (!studio) redirect('/login?callbackUrl=%2Fartist%2Fwork%2Fnew');

  // Work belongs to a profile. Sending someone to a form that cannot save is
  // worse than sending them to the step that unblocks it.
  if (!studio.artist) redirect('/artist/onboarding');

  return (
    <NarrowPage>
      <PageHeader
        eyebrow="Your studio"
        title="Add a work"
        intro="A title is enough to save it. The fuller the record, the sooner it can be released."
        className="mb-10"
      />

      <ArtworkForm onSubmit={submitArtwork} />

      <p className="text-muted mt-10 text-sm">
        <Link href="/artist/dashboard" className="text-accent underline underline-offset-4">
          Back to your dashboard
        </Link>
      </p>
    </NarrowPage>
  );
}
