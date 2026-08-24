import Image from 'next/image';
import Link from 'next/link';

export type ArtistCardArtist = {
  id: string;
  displayName: string;
  slug: string;
  statement: string | null;
  availableCount: number;
  coverImage: string | null;
};

/**
 * An artist in a list.
 *
 * The cover is the most recent listed work, so the card shows the practice
 * rather than a portrait we do not have. Same accessibility shape as ArtCard:
 * the image link is hidden from assistive tech so the card announces once.
 */
export function ArtistCard({ artist }: { artist: ArtistCardArtist }) {
  return (
    <article className="group flex flex-col gap-4">
      <Link
        href={`/artists/${artist.slug}`}
        aria-hidden="true"
        tabIndex={-1}
        className="bg-surface block overflow-hidden rounded-(--radius-soft)"
      >
        <div className="relative aspect-4/3">
          {artist.coverImage ? (
            <Image
              src={artist.coverImage}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="text-muted flex h-full items-center justify-center text-xs">
              Image coming soon
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg leading-snug">
          <Link href={`/artists/${artist.slug}`} className="hover:text-accent transition-colors">
            {artist.displayName}
          </Link>
        </h3>
        <p className="text-muted text-xs">
          {artist.availableCount} {artist.availableCount === 1 ? 'work' : 'works'} available
        </p>
        {artist.statement && (
          <p className="text-body mt-2 line-clamp-3 text-sm leading-relaxed">{artist.statement}</p>
        )}
      </div>
    </article>
  );
}
