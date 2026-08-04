import { cn } from '@qhakaza/shared-ui';

/**
 * The repeated section opening: a tan letterspaced eyebrow, a short rule, then
 * a large light serif heading and optional supporting line.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  id,
  as: Heading = 'h2',
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  id?: string;
  as?: 'h1' | 'h2';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <span className="rule" aria-hidden="true" />
      <Heading id={id} className="max-w-xl text-4xl leading-[1.15] sm:text-5xl">
        {title}
      </Heading>
      {subtitle && <p className="text-body max-w-lg leading-relaxed">{subtitle}</p>}
    </div>
  );
}
