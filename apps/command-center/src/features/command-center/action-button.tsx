'use client';

import { useState, useTransition } from 'react';

import { Button, cn } from '@qhakaza/shared-ui';

type Result = { ok: boolean; error?: string; token?: string };

/**
 * Runs one bound server action and reports what happened.
 *
 * The action arrives pre-bound from the server component, so its arguments are
 * fixed on the server and cannot be re-pointed from the browser. Every action
 * re-authorises anyway — this is convenience, not a control.
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = 'secondary',
  confirm,
  revealsSecret = false,
}: {
  action: () => Promise<Result>;
  label: string;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Shown before running, for anything that is awkward to undo. */
  confirm?: string;
  /** The result carries a one-time token that must be shown to the operator. */
  revealsSecret?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          if (revealsSecret && result.token) setSecret(result.token);
        } else {
          setError(result.error ?? 'UNKNOWN');
        }
      } catch {
        setError('UNKNOWN');
      }
    });
  }

  return (
    <span className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={run}
        className={cn('caps')}
      >
        {pending ? (pendingLabel ?? 'Working…') : label}
      </Button>

      {error && (
        <span role="alert" className="text-danger text-xs">
          {error === 'FORBIDDEN'
            ? 'Not permitted'
            : error === 'INVALID'
              ? 'Not allowed in this state'
              : error === 'NOT_FOUND'
                ? 'No longer there'
                : 'Something went wrong'}
        </span>
      )}

      {secret && (
        <span
          role="status"
          className="border-accent/50 bg-accent-soft/40 flex flex-col gap-1 border p-3"
        >
          <span className="caps text-accent-ink">Invitation link — shown once</span>
          {/* Only the SHA-256 is stored, so this cannot be read back later. If
              it is lost, the invitation must be reissued. */}
          <code className="text-body text-xs break-all">/private/{secret}</code>
        </span>
      )}
    </span>
  );
}
