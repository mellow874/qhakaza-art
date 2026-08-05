import Link from 'next/link';

import { brand } from '@/content/collectors';

/**
 * Chrome for the private area.
 *
 * NO DESIGN WAS SUPPLIED for the concierge screens, so this is deliberately
 * plain: it uses the established tokens and nothing invented beyond what the
 * navigation needs. It is meant to be replaced wholesale when the designs
 * arrive, not treated as a proposal.
 *
 * The token stays in the path on every link. It is the access credential, so
 * losing it mid-journey would drop the member out of the area.
 */
export function PrivateChrome({ token, children }: { token: string; children: React.ReactNode }) {
  const base = `/private/${token}`;

  const links = [
    { href: base, label: 'Overview' },
    { href: `${base}/discover`, label: 'Discover' },
    { href: `${base}/enquiries`, label: 'Enquiries' },
  ];

  return (
    <div className="theme-light bg-canvas text-body flex min-h-svh flex-col">
      <header className="border-line/70 bg-raised/80 sticky top-0 z-50 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-4">
          <div className="flex flex-col leading-tight">
            <span className="font-display text-heading text-lg font-semibold">{brand.name}</span>
            <span className="eyebrow">Private access</span>
          </div>

          <nav aria-label="Member" className="flex flex-wrap items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="caps text-body hover:text-heading transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-line/70 border-t">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <p className="text-muted text-sm italic">
            Private access. Curated intelligence. Quiet confidence.
          </p>
        </div>
      </footer>
    </div>
  );
}
