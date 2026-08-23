import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonStyles } from '@qhakaza/shared-ui';

import { ArtCard } from '@/features/catalogue/art-card';
import { getWorkById } from '@/features/catalogue/queries';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const found = await getWorkById(id);

  if (!found) return { title: 'Work not found' };

  return {
    title: `${found.work.title} — ${found.work.artist.displayName}`,
    description: found.work.description?.slice(0, 200) || undefined,
  };
}

export default async function ArtworkPage({ params }: Props) {
  const { id } = await params;
  const found = await getWorkById(id);

  // Anything not authorised for public editorial use is a 404 here - a draft,
  // an approved-but-unreleased work, or one whose artist has not granted public
  // publication. The query decides; this page never sees what it must not show.
  if (!found) notFound();

  const { work, alsoBy } = found;
  const details = [
    ['Medium', work.medium],
    ['Dimensions', work.dimensions],
  ].filter(([, value]) => Boolean(value));

  return (
    <main className="flex flex-col">
      <div className="mx-auto grid w-full max-w-7xl gap-16 px-6 py-24 sm:py-28 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {work.images.length === 0 ? (
            <div className="bg-surface text-muted flex aspect-4/5 items-center justify-center rounded-(--radius-soft) text-xs">
              Image coming soon
            </div>
          ) : (
            work.images.map((src, index) => (
              <div
                key={src}
                className="bg-surface relative aspect-4/5 overflow-hidden rounded-(--radius-soft)"
              >
                <Image
                  src={src}
                  // The first image carries the work's identity; the rest are
                  // further views of the same piece and are described as such.
                  alt={index === 0 ? work.title : `${work.title}, further view`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority={index === 0}
                />
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Selected work</p>
            <h1 className="text-4xl leading-[1.15] sm:text-5xl">{work.title}</h1>
            <Link
              href={`/artists/${work.artist.slug}`}
              className="text-muted hover:text-accent w-fit transition-colors"
            >
              {work.artist.displayName}
            </Link>
          </div>

          {work.description && (
            <p className="text-body leading-relaxed whitespace-pre-line">{work.description}</p>
          )}

          {details.length > 0 && (
            <dl className="border-line/70 flex flex-col border-t">
              {details.map(([label, value]) => (
                <div key={label} className="border-line/70 flex justify-between gap-6 border-b py-4">
                  <dt className="text-muted text-sm">{label}</dt>
                  <dd className="text-body text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/*
            NOT AN OFFER. This page introduces a work Qhakaza has chosen to
            show; availability and price are collector-platform matters and are
            governed there. Asking about the programme is the honest next step.
          */}
          <p className="text-muted text-sm leading-relaxed">
            Work shown here is presented as part of Qhakaza&rsquo;s editorial programme.
            Availability and acquisition are handled privately with member collectors.
          </p>
          <Link href="/contact" className={buttonStyles({ size: 'lg', className: 'self-start' })}>
            Enquire about the programme
          </Link>
        </div>
      </div>

      {alsoBy.length > 0 && (
        <section className="border-line/60 border-t">
          <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-28">
            <h2 className="mb-12 text-2xl">Also by {work.artist.displayName}</h2>
            <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
              {alsoBy.map((other) => (
                <ArtCard key={other.id} work={other} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
