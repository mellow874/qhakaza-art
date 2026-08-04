import { cn } from '@qhakaza/shared-ui';

/**
 * The recurring editorial page opening from the reference: a small uppercase
 * eyebrow, a large light serif heading, and a short line of supporting copy,
 * with generous space around them.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  className,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      {eyebrow && <p className="text-muted text-xs tracking-[0.2em] uppercase">{eyebrow}</p>}
      <h1 className="text-4xl leading-tight sm:text-5xl">{title}</h1>
      {intro && <p className="text-muted max-w-xl leading-relaxed">{intro}</p>}
    </header>
  );
}

/** Centred single-column page body, sized for forms and prose. */
export function NarrowPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        'mx-auto w-full max-w-2xl px-6 py-(--spacing-section-sm) sm:py-(--spacing-section)',
        className,
      )}
    >
      {children}
    </main>
  );
}
