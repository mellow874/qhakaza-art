import Link from 'next/link';

import { buttonStyles } from '@qhakaza/shared-ui';

/**
 * A legal document that has not been written yet.
 *
 * The footer has linked to `/privacy` and `/terms` since the design was
 * transcribed, and neither route existed — both 404'd from every page on the
 * site.
 *
 * A privacy policy and terms of service are legal instruments describing what
 * this business actually does with personal data and on what terms it trades.
 * Inventing that text would be worse than the 404: it would be a false
 * statement of the company's obligations, and people would rely on it. So the
 * page says plainly that the document is being prepared and offers a way to
 * ask.
 *
 * Deliberately `noindex` — a placeholder legal page should not be the result
 * anyone finds in a search.
 *
 * To finish: replace the usage in the route with the real document.
 */
export function LegalPlaceholder({ title, kind }: { title: string; kind: string }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-6 px-6 py-24">
      <p className="eyebrow">Legal</p>
      <h1 className="text-4xl leading-[1.15] sm:text-5xl">{title}</h1>
      <p className="text-body leading-relaxed">
        Qhakaza&rsquo;s {kind} is being prepared and is not yet published. We would rather show
        nothing than publish a document that does not accurately describe how we operate.
      </p>
      <p className="text-body leading-relaxed">
        If you need to know how we handle your information before that is published, ask us
        directly and we will answer.
      </p>
      <div className="mt-2 flex flex-wrap gap-4">
        <Link href="/contact" className={buttonStyles({ size: 'md' })}>
          Contact us
        </Link>
        <Link href="/" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
          Back to the home page
        </Link>
      </div>
    </main>
  );
}
