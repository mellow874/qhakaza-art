import Link from 'next/link';

import { cn } from '@/lib/cn';

import { buttonStyles } from './ui/button';

/**
 * The closing call to action at the foot of the marketing pages.
 *
 * Two layouts appear in the designs: `centred` (heading, supporting line and
 * button stacked, as on How It Works) and `split` (heading left, button right,
 * as on About and Features).
 */
export function CtaBand({
  title,
  subtitle,
  label,
  href,
  secondary,
  layout = 'centred',
}: {
  title: string;
  subtitle?: string;
  label: string;
  href: string;
  /** Optional lower-emphasis action shown before the primary one, as on FAQ. */
  secondary?: { label: string; href: string };
  layout?: 'centred' | 'split';
}) {
  const centred = layout === 'centred';

  return (
    <section aria-labelledby="cta-band" className="bg-surface/40 border-line/60 border-t">
      <div
        className={cn(
          'mx-auto w-full px-6 py-24 sm:py-28',
          centred
            ? 'flex max-w-3xl flex-col items-center gap-6 text-center'
            : 'flex max-w-7xl flex-wrap items-center justify-between gap-10',
        )}
      >
        <div className={cn('flex flex-col gap-4', !centred && 'max-w-2xl')}>
          <h2 id="cta-band" className="text-3xl sm:text-4xl">
            {title}
          </h2>
          {subtitle && <p className="text-body leading-relaxed">{subtitle}</p>}
        </div>

        <div className={cn('flex flex-wrap items-center gap-4', centred && 'mt-4')}>
          {secondary && (
            <Link
              href={secondary.href}
              className={buttonStyles({ variant: 'secondary', size: 'lg' })}
            >
              {secondary.label}
            </Link>
          )}
          <Link href={href} className={buttonStyles({ size: 'lg' })}>
            {label} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
