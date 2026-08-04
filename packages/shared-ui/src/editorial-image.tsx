import Image from 'next/image';

import { cn } from './cn';

/**
 * A photograph that may not exist yet.
 *
 * Until the real asset is supplied, this renders a tinted surface of the same
 * dimensions so the page's rhythm is correct and nothing 404s. Alt text is
 * required either way, so it is already right when the photograph lands.
 *
 * Takes the resolved `src` rather than a key into a registry. It used to look
 * the name up in the app's own `content/images.ts`, which meant this shared
 * component reached back into an app — fine while there was one app, broken the
 * moment there were three. Each app now owns its registry and passes the entry
 * in, so the dependency points the right way.
 */
export function EditorialImage({
  src,
  alt,
  priority = false,
  sizes = '100vw',
  className,
}: {
  /** `null` when the photograph has not been supplied yet. */
  src: string | null | undefined;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn('from-raised to-surface bg-gradient-to-br', className)}
      />
    );
  }

  return <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={className} />;
}
