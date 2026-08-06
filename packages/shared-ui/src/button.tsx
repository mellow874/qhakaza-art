import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@qhakaza/shared-ui';

/**
 * Exported so a `<Link>` can wear the same styles without needing a Slot
 * primitive — anchors and buttons stay semantically distinct.
 */
export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-(--radius-card) font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // `on-accent` is dark in both themes: cream on camel is only ~2.6:1.
        primary: 'bg-accent text-on-accent hover:bg-accent-hover',
        // Accent hairline box with accent text — the header CTA.
        outline: 'border border-accent/70 text-accent-ink hover:bg-accent hover:text-on-accent',
        secondary: 'border border-line-strong text-heading hover:bg-raised',
        ghost: 'text-accent-ink hover:text-accent-hover underline underline-offset-4',
      },
      // Case is deliberately not imposed here. The designs use uppercase
      // letterspaced labels for the nav CTAs but mixed case for the page-level
      // "Get Started" actions, so callers add `.caps` where it belongs.
      size: {
        sm: 'h-9 px-5 text-xs',
        md: 'h-12 px-4 text-sm',
        lg: 'h-12 px-4 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
