import Link from 'next/link';

import { brand, footer } from '@/content/collectors';

/** Dark footer closing the light collector pages. */
export function CollectorFooter() {
  return (
    <footer className="theme-dark bg-canvas border-line/60 border-t">
      <div className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <p className="font-display text-heading text-lg font-semibold">{brand.name}</p>
            <p className="eyebrow">{brand.suite}</p>
            <p className="text-muted mt-3 max-w-xs text-sm leading-relaxed">{footer.tagline}</p>
          </div>

          {footer.columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-5">
              <p className="eyebrow">{column.heading}</p>
              <ul className="flex flex-col gap-4">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-body hover:text-accent-ink text-sm transition-colors"
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
          <p className="text-muted caps">
            © {new Date().getFullYear()} {brand.name}
          </p>
          <p className="text-muted text-sm italic">{footer.note}</p>
        </div>
      </div>
    </footer>
  );
}
