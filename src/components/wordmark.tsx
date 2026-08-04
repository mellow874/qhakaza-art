import Link from 'next/link';

import { cn } from '@qhakaza/shared-ui';

/**
 * The signature-style wordmark from the design: "Qhakaza" in script, with a
 * small letterspaced descender line beneath it.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Qhakaza Art Collective — home"
      className={cn('group inline-flex flex-col items-start leading-none', className)}
    >
      <span className="font-script text-heading text-3xl leading-none">Qhakaza</span>
      <span className="text-muted mt-0.5 self-end text-[0.5rem] tracking-[0.25em] uppercase">
        Art Collective
      </span>
    </Link>
  );
}
