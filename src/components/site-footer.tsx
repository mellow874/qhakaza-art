import Link from 'next/link';

import { FOOTER_COLUMNS, FOOTER_MARK, FOOTER_TAGLINE } from '@/content/navigation';

import { Wordmark } from './wordmark';

export function SiteFooter() {
  return (
    // Lifted very slightly off the page ground, matching the design — and
    // continuous with the CTA band above it, separated only by a hairline.
    <footer className="bg-surface/40 border-line/60 border-t">
      <div className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="grid gap-14 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-6">
            <Wordmark />
            <span className="rule" />
            <p className="text-muted max-w-xs text-sm leading-relaxed">{FOOTER_TAGLINE}</p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-5">
              <p className="eyebrow">{column.heading}</p>
              <ul className="flex flex-col gap-4">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-body hover:text-accent text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-line/60 mt-16 flex flex-wrap items-center justify-between gap-4 border-t pt-8">
          <p className="text-muted text-xs">
            © {new Date().getFullYear()} Qhakaza Art Collective. All rights reserved.
          </p>
          <p className="text-accent/50 text-xs tracking-[0.2em] uppercase">{FOOTER_MARK}</p>
        </div>
      </div>
    </footer>
  );
}
