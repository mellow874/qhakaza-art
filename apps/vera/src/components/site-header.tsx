'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';

import { MAIN_NAV, SIGN_IN, SUITE_CTA } from '@/content/navigation';
import type { Role } from '@qhakaza/shared-auth';
import { cn } from '@qhakaza/shared-ui';

import { Wordmark } from './wordmark';
import { buttonStyles } from '@qhakaza/shared-ui';

/**
 * Where each role's own area lives, once signed in.
 *
 * Typed as a total `Record<Role, …>` deliberately: adding a role to the model
 * without deciding where it lands is a type error rather than a broken link.
 * That is how ADVISOR was caught.
 */
const ACCOUNT_LINKS: Record<Role, { href: string; label: string }> = {
  ARTIST: { href: '/artist/dashboard', label: 'Dashboard' },
  COLLECTOR: { href: '/collector/favourites', label: 'Favourites' },
  ADMIN: { href: '/admin', label: 'Admin' },
  ADVISOR: { href: '/admin', label: 'Admin' },
  // Analysts work Cases, which live in the Command Center alongside the rest
  // of the back office. Caught by this Record exactly as ADVISOR was.
  ANALYST: { href: '/admin', label: 'Admin' },
};

export type HeaderSession = { user: { name?: string | null; role: Role } } | null;

export function SiteHeader({ session }: { session: HeaderSession }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();

  const account = session ? ACCOUNT_LINKS[session.user.role] : null;

  const isCurrent = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);

  return (
    <header className="border-line/60 bg-canvas/95 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-8 px-6 py-4">
        <Wordmark />

        <nav aria-label="Main" className="hidden items-center gap-9 lg:flex">
          {MAIN_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href) ? 'page' : undefined}
              className={cn(
                'text-xs tracking-[0.18em] uppercase transition-colors',
                isCurrent(link.href) ? 'text-accent' : 'text-body hover:text-heading',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          {account ? (
            <Link
              href={account.href}
              className={buttonStyles({ variant: 'outline', size: 'md', className: 'caps' })}
            >
              {account.label}
            </Link>
          ) : (
            <>
              <Link
                href={SIGN_IN.href}
                className="text-body hover:text-heading text-xs tracking-[0.18em] uppercase transition-colors"
              >
                {SIGN_IN.label}
              </Link>
              <Link
                href={SUITE_CTA.href}
                className={buttonStyles({ variant: 'outline', size: 'md', className: 'caps' })}
              >
                {SUITE_CTA.label}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={menuId}
          className="text-heading text-xs tracking-[0.18em] uppercase lg:hidden"
        >
          {open ? 'Close menu' : 'Open menu'}
        </button>
      </div>

      {/* Kept mounted so `aria-controls` always points at a real element. */}
      <div id={menuId} hidden={!open} className="border-line/60 border-t px-6 py-6 lg:hidden">
        <nav aria-label="Mobile" className="flex flex-col gap-5">
          {MAIN_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                'text-xs tracking-[0.18em] uppercase',
                isCurrent(link.href) ? 'text-accent' : 'text-body',
              )}
            >
              {link.label}
            </Link>
          ))}

          <span className="bg-line my-1 h-px w-full" />

          {account ? (
            <Link
              href={account.href}
              onClick={() => setOpen(false)}
              className="text-accent text-xs tracking-[0.18em] uppercase"
            >
              {account.label}
            </Link>
          ) : (
            <>
              <Link
                href={SIGN_IN.href}
                onClick={() => setOpen(false)}
                className="text-body text-xs tracking-[0.18em] uppercase"
              >
                {SIGN_IN.label}
              </Link>
              <Link
                href={SUITE_CTA.href}
                onClick={() => setOpen(false)}
                className="text-accent text-xs tracking-[0.18em] uppercase"
              >
                {SUITE_CTA.label}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
