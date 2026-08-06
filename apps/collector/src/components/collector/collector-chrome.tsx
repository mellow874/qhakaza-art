'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';

import { buttonStyles, cn } from '@qhakaza/shared-ui';
import { APPLY_CTA, brand, NAV } from '@/content/collectors';

/**
 * The Collector Intelligence Suite has its own wordmark and navigation, so it
 * gets its own header rather than a variant of the artist site's.
 */
export function CollectorHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();

  const isCurrent = (href: string) => pathname === href;

  return (
    <header className="border-line/70 bg-raised/80 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-8 px-6 py-4">
        <Link href="/collectors" className="flex flex-col leading-tight">
          <span className="font-display text-heading text-lg font-semibold">{brand.name}</span>
          <span className="eyebrow">{brand.suite}</span>
        </Link>

        <nav aria-label="Collector" className="hidden items-center gap-10 lg:flex">
          {NAV.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              aria-current={isCurrent(link.href) ? 'page' : undefined}
              className={cn(
                'caps transition-colors',
                isCurrent(link.href) ? 'text-heading' : 'text-body hover:text-heading',
              )}
            >
              {link.label}
            </Link>
          ))}

          <Link href={APPLY_CTA.href} className={buttonStyles({ size: 'lg', className: 'caps' })}>
            {APPLY_CTA.label}
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={menuId}
          className="text-heading caps lg:hidden"
        >
          {open ? 'Close menu' : 'Open menu'}
        </button>
      </div>

      <div id={menuId} hidden={!open} className="border-line/70 border-t px-6 py-6 lg:hidden">
        <nav aria-label="Collector mobile" className="flex flex-col gap-5">
          {NAV.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              aria-current={isCurrent(link.href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
              className={cn('caps', isCurrent(link.href) ? 'text-heading' : 'text-body')}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={APPLY_CTA.href}
            onClick={() => setOpen(false)}
            className={buttonStyles({ size: 'lg', className: 'caps self-start' })}
          >
            {APPLY_CTA.label}
          </Link>
        </nav>
      </div>
    </header>
  );
}
