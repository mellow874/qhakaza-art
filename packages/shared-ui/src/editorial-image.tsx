import Image from 'next/image';

import { IMAGES } from '@/content/images';
import { cn } from '@qhakaza/shared-ui';

/**
 * A photograph that may not exist yet.
 *
 * Until the real asset is added to `content/images.ts`, this renders a tinted
 * surface of the same dimensions so the page's rhythm is correct and nothing
 * 404s. Alt text is required either way, so it is already right when the
 * photograph lands.
 */
export function EditorialImage({
  name,
  alt,
  priority = false,
  sizes = '100vw',
  className,
}: {
  name: keyof typeof IMAGES | string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const src = IMAGES[name] ?? null;

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
