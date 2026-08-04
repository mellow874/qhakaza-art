'use client';

import { useId } from 'react';

import { cn } from '@/lib/cn';

const CONTROL = {
  box: 'rounded-(--radius-card) border bg-surface px-4 py-3',
  underline: 'border-0 border-b bg-transparent px-0 py-3',
} as const;

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Sentence-case on the artist site; letterspaced caps in the collector suite. */
  labelCase?: 'sentence' | 'caps';
  /** Boxed on the artist site; a single hairline underneath in the collector suite. */
  control?: 'box' | 'underline';
  /**
   * Which half of the form gets annotated. Marking the *optional* fields is the
   * kinder default — most fields are required, so most labels stay clean — but
   * the collector intake's design marks the two required fields with an
   * asterisk instead, and a form should not do both.
   */
  marks?: 'optional' | 'required';
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
    className: string;
    required: boolean;
  }) => React.ReactNode;
};

/**
 * Wires a label, hint and error message to a control with the right ARIA
 * relationships, so an error is announced rather than merely displayed.
 */
export function Field({
  label,
  error,
  hint,
  required = false,
  labelCase = 'sentence',
  control = 'box',
  marks = 'optional',
  children,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          labelCase === 'caps' ? 'text-accent-ink caps' : 'text-heading text-sm font-medium',
        )}
      >
        {label}
        {marks === 'optional' && !required && (
          <span className="text-muted ml-2 text-xs font-normal">Optional</span>
        )}
        {/* The control carries `required`, so the asterisk is decoration on top
            of a real constraint rather than the only signal. */}
        {marks === 'required' && required && (
          <span className="text-accent-ink ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      )}

      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
        className: cn(
          'text-body placeholder:text-muted/60 focus:border-accent w-full transition-colors focus:outline-none',
          CONTROL[control],
          error ? 'border-danger' : 'border-line',
        ),
        required,
      })}

      {error && (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
