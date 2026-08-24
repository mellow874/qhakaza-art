'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@qhakaza/shared-ui';

/**
 * Handing a work to Qhakaza.
 *
 * Confirmed rather than one-click, because submission is one-way: afterwards
 * the artist cannot quietly edit the record a reviewer is reading. If something
 * needs changing, the reviewer returns it with a question.
 */
export function SubmitForReview({
  artworkId,
  status,
  onSubmit,
}: {
  artworkId: string;
  status: string;
  onSubmit: (input: { artworkId: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const resubmitting = status === 'RETURNED_FOR_INFORMATION';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted max-w-xl text-sm leading-relaxed">
        {resubmitting
          ? 'When you have addressed the request, send this work back to Qhakaza.'
          : 'Once submitted you will not be able to edit this work while it is being reviewed.'}
      </p>

      {error && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-3 text-sm">
          {error}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        disabled={busy}
        className="self-start"
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const result = await onSubmit({ artworkId });
            if (result.ok) {
              router.push('/artist/dashboard');
              router.refresh();
            } else {
              setError('This work could not be submitted. Please refresh and try again.');
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Sending…' : resubmitting ? 'Resubmit for review' : 'Submit for review'}
      </Button>
    </div>
  );
}
