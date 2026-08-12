import Link from 'next/link';

import { EditorialImage } from '@qhakaza/shared-ui';
import type { Briefing } from '@/content/briefings';

/**
 * One briefing in a grid. Used on both the home strip and the /briefings index,
 * so the two stay identical.
 *
 * The image is decorative here: the category, title and date beside it already
 * describe the article, and the title is the accessible link.
 */
export function BriefingCard({ briefing }: { briefing: Briefing }) {
  return (
    <article className="group flex flex-col">
      <Link
        href={`/briefings/${briefing.slug}`}
        aria-hidden="true"
        tabIndex={-1}
        className="bg-surface relative block aspect-4/3 overflow-hidden"
      >
        <EditorialImage
  src={briefing.image}
  alt={briefing.imageAlt}
          sizes="(max-width: 640px) 100vw, 40vw"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-3 pt-6">
        <p className="eyebrow">{briefing.category}</p>

        <h3 className="text-2xl leading-snug">
          <Link
            href={`/briefings/${briefing.slug}`}
            className="hover:text-accent transition-colors"
          >
            {briefing.title}
          </Link>
        </h3>

        <p className="text-body text-sm leading-relaxed">{briefing.excerpt}</p>

        <time dateTime={briefing.date} className="text-muted mt-4 text-sm">
          {briefing.dateLabel}
        </time>
      </div>
    </article>
  );
}
