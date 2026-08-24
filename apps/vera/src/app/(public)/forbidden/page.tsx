import type { Metadata } from 'next';
import Link from 'next/link';

import { buttonStyles } from '@qhakaza/shared-ui';

export const metadata: Metadata = {
  title: 'Not available',
  robots: { index: false, follow: false },
};

/**
 * Where role fencing sends someone who is signed in but not entitled.
 *
 * Deliberately says nothing about what is behind the door: naming it would
 * tell an unentitled account exactly what to go looking for.
 */
export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <p className="eyebrow">Not available</p>
      <h1 className="text-4xl leading-[1.15] sm:text-5xl">This area is not open to your account</h1>
      <p className="text-body leading-relaxed">
        You are signed in, but this part of Qhakaza is limited to other accounts. If you believe
        this is a mistake, get in touch and we will look into it.
      </p>
      <div className="mt-2 flex flex-wrap gap-4">
        <Link href="/" className={buttonStyles({ size: 'md' })}>
          Back to the home page
        </Link>
        <Link href="/contact" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
          Contact us
        </Link>
      </div>
    </main>
  );
}
