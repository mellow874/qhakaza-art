import Link from 'next/link';

import { buttonStyles } from '@qhakaza/shared-ui';

import { DemoNotice } from './demo-notice';

/**
 * A published legal document, or an honest statement that there is not one yet.
 *
 * Both pages share this, because the two behave identically and differ only in
 * their text. The version and effective date are shown deliberately: a legal
 * document without them cannot be referred back to.
 */
export function LegalDocument({
  fallbackTitle,
  kind,
  document,
  history,
}: {
  fallbackTitle: string;
  kind: string;
  document: {
    title: string;
    body: string;
    versionNumber: string;
    effectiveFrom: Date;
    isDemo: boolean;
  } | null;
  history: { id: string; versionNumber: string; effectiveFrom: Date }[];
}) {
  if (!document) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-6 px-6 py-24">
        <p className="eyebrow">Legal</p>
        <h1 className="text-4xl leading-[1.15] sm:text-5xl">{fallbackTitle}</h1>
        <p className="text-body leading-relaxed">
          Qhakaza&rsquo;s {kind} is being prepared and is not yet published. We would rather show
          nothing than publish a document that does not accurately describe how we operate.
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          <Link href="/contact" className={buttonStyles({ size: 'md' })}>
            Contact us
          </Link>
        </div>
      </main>
    );
  }

  const paragraphs = document.body.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-24">
      <div className="flex flex-col gap-3">
        <p className="eyebrow">Legal</p>
        <h1 className="text-4xl leading-[1.15] sm:text-5xl">{document.title}</h1>
        <p className="text-muted text-sm">
          Version {document.versionNumber} &middot; in force from{' '}
          <time dateTime={document.effectiveFrom.toISOString()}>
            {document.effectiveFrom.toLocaleDateString('en-ZA', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </time>
        </p>
      </div>

      {document.isDemo && <DemoNotice what="This document" />}

      <div className="flex flex-col gap-5">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-body leading-relaxed whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Earlier versions are retained, so what someone agreed to on the day
          can still be produced. Listed rather than hidden. */}
      {history.length > 1 && (
        <section className="border-line/70 flex flex-col gap-2 border-t pt-6">
          <h2 className="caps text-muted">Previous versions</h2>
          <ul className="text-muted flex flex-col gap-1 text-sm">
            {history.map((version) => (
              <li key={version.id}>
                Version {version.versionNumber} &mdash;{' '}
                {version.effectiveFrom.toLocaleDateString('en-ZA')}
              </li>
            ))}
          </ul>
          <p className="text-muted mt-2 text-xs">
            Ask us for the full text of any earlier version.
          </p>
        </section>
      )}
    </main>
  );
}
