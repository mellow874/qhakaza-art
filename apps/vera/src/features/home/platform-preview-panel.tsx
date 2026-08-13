import Image from 'next/image';

import { platformPreview } from '@/content/home';

const { sample } = platformPreview;

/**
 * The sample artist record shown alongside the platform-preview copy.
 *
 * This is illustrative content from the design, not a real record — it is
 * marked `aria-label`led as an example so it is not mistaken for live data.
 */
export function PlatformPreviewPanel() {
  return (
    <div
      aria-label="Example artist record"
      className="border-line/70 bg-surface/40 flex flex-col border p-8 sm:p-10"
    >
      <div className="border-line/50 flex items-center gap-4 border-b pb-6">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm" aria-hidden="true">
          <Image src={sample.artist.image} alt="" fill className="object-cover" sizes="56px" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-heading text-lg">{sample.artist.name}</p>
          <p className="text-muted text-sm">{sample.artist.detail}</p>
        </div>
      </div>

      <ul className="flex flex-col">
        {sample.works.map((work) => (
          <li
            key={work.reference}
            className="border-line/50 flex items-center gap-4 border-b py-5 last:border-b-0"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm" aria-hidden="true">
              <Image src={work.image} alt="" fill className="object-cover" sizes="40px" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-heading truncate text-sm">{work.title}</p>
              <p className="text-accent text-xs">{work.reference}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <p className="text-heading text-sm tabular-nums">{work.score}%</p>
              <p className="text-muted text-xs">{work.status}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
