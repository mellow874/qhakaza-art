import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { requireRole } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';
import { buttonStyles } from '@qhakaza/shared-ui';

import { getMyStudio } from '@/features/artwork/actions';
import { ImageUploader } from '@/features/artwork/image-uploader';
import {
  confirmUpload,
  getStorageStatus,
  listUploads,
  removeUpload,
  requestUpload,
} from '@/features/artwork/upload-actions';

export const metadata: Metadata = {
  title: 'Photographs',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/**
 * Adding photographs to a work.
 *
 * A separate screen from the submission form on purpose: an image has to belong
 * to something, and uploading against a work that does not exist yet would mean
 * either holding files in memory until the form is saved, or writing rows for
 * a work that may never be created. Saving first is the simpler, honest order,
 * and the form says so.
 */
export default async function WorkPhotographsPage({ params }: Props) {
  const { id } = await params;

  const grant = requireRole(await auth(), ['ARTIST']);
  if (!grant.ok) redirect(`/login?callbackUrl=/artist/work/${id}`);

  const studio = await getMyStudio();
  const work = studio?.artworks.find((artwork) => artwork.id === id);

  // Not found rather than forbidden: whether another artist's work exists is
  // not this artist's business.
  if (!work) notFound();

  const [uploads, storage] = await Promise.all([listUploads(id), getStorageStatus()]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-muted text-xs tracking-[0.2em] uppercase">Photographs</p>
        <h1 className="text-4xl">{work.title}</h1>
        <p className="text-body max-w-xl leading-relaxed">
          Add photographs of this work. The first one is what collectors see first.
        </p>
      </header>

      {uploads.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl">Already uploaded</h2>
          <ul className="border-line/70 flex flex-col border-t">
            {uploads.map((upload) => (
              <li
                key={upload.id}
                className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
              >
                <span className="text-heading text-sm">{upload.originalFilename}</span>
                <span className="text-muted text-xs">
                  {(upload.sizeBytes / (1024 * 1024)).toFixed(1)}MB
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">Add photographs</h2>
        <ImageUploader
          artworkId={id}
          storageConfigured={storage.configured}
          requestUpload={requestUpload}
          confirmUpload={confirmUpload}
          removeUpload={removeUpload}
        />
      </section>

      <Link
        href="/artist/dashboard"
        className={buttonStyles({ variant: 'secondary', size: 'md', className: 'self-start' })}
      >
        Back to your dashboard
      </Link>
    </div>
  );
}
