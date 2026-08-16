'use client';

import { useRef, useState } from 'react';

import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@qhakaza/shared-storage';

/**
 * Choosing and uploading artwork photographs.
 *
 * The browser sends the bytes straight to storage using a short-lived URL the
 * server issues, so nothing large passes through Next.js.
 *
 * XMLHttpRequest rather than fetch, for one reason: fetch cannot report upload
 * progress. On a South African mobile connection a 12MB photograph takes long
 * enough that a bar which does not move reads as a broken page.
 *
 * The preview comes from a local object URL, so it appears the instant a file
 * is chosen rather than after a round trip. Each one is revoked when it is
 * replaced or removed; without that the page leaks a blob per selection.
 */

export type PendingImage = {
  /** Local id before upload; the MediaAsset id afterwards. */
  key: string;
  file: File;
  previewUrl: string;
  progress: number;
  assetId?: string;
  error?: string;
  done: boolean;
};

type Ticket = { assetId: string; url: string; token: string; path: string; bucket: string };

type Props = {
  /** Uploads attach to a work, so it must exist first. */
  artworkId: string | null;
  storageConfigured: boolean;
  requestUpload: (input: {
    artworkId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }) => Promise<{ ok: true; value: Ticket } | { ok: false; error: string }>;
  confirmUpload: (input: {
    assetId: string;
  }) => Promise<{ ok: true; value: { storagePath: string } } | { ok: false; error: string }>;
  removeUpload: (input: {
    assetId: string;
  }) => Promise<{ ok: true; value: null } | { ok: false; error: string }>;
};

/** PUT the bytes, reporting progress. Resolves on 2xx, rejects otherwise. */
function putWithProgress(
  ticket: Ticket,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', ticket.url, true);
    request.setRequestHeader('content-type', file.type);
    // Supabase's signed upload URL carries its authorisation as a token.
    request.setRequestHeader('authorization', `Bearer ${ticket.token}`);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${request.status})`));

    request.onerror = () => reject(new Error('The connection dropped during upload.'));
    request.onabort = () => reject(new Error('Upload cancelled.'));

    request.send(file);
  });
}

export function ImageUploader({
  artworkId,
  storageConfigured,
  requestUpload,
  confirmUpload,
  removeUpload,
}: Props) {
  const [images, setImages] = useState<PendingImage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<PendingImage>) =>
    setImages((current) =>
      current.map((image) => (image.key === key ? { ...image, ...patch } : image)),
    );

  async function handleFiles(files: FileList | null) {
    if (!files || !artworkId) return;

    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;

      // Checked here too, so an obviously wrong file is refused instantly
      // rather than after a round trip. The server checks again regardless.
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        setImages((current) => [
          ...current,
          {
            key,
            file,
            previewUrl: '',
            progress: 0,
            done: false,
            error: 'Use a JPEG, PNG or WebP image.',
          },
        ]);
        continue;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        setImages((current) => [
          ...current,
          {
            key,
            file,
            previewUrl: '',
            progress: 0,
            done: false,
            error: `That image is ${(file.size / (1024 * 1024)).toFixed(1)}MB. The limit is ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB.`,
          },
        ]);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      setImages((current) => [...current, { key, file, previewUrl, progress: 0, done: false }]);

      try {
        const ticket = await requestUpload({
          artworkId,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });

        if (!ticket.ok) {
          update(key, { error: ticket.error });
          continue;
        }

        update(key, { assetId: ticket.value.assetId });
        await putWithProgress(ticket.value, file, (percent) => update(key, { progress: percent }));

        const confirmed = await confirmUpload({ assetId: ticket.value.assetId });
        if (!confirmed.ok) {
          update(key, { error: confirmed.error });
          continue;
        }

        update(key, { done: true, progress: 100 });
      } catch (error) {
        update(key, {
          error: error instanceof Error ? error.message : 'The upload failed. Please try again.',
        });
      }
    }

    // Let the same file be chosen again after a failure.
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleRemove(image: PendingImage) {
    if (image.assetId) await removeUpload({ assetId: image.assetId });
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    setImages((current) => current.filter((item) => item.key !== image.key));
  }

  if (!storageConfigured) {
    return (
      <div className="border-line/70 text-muted border border-dashed p-6 text-sm leading-relaxed">
        <strong className="text-heading block">File uploads are not available yet.</strong>
        Storage has not been connected. Add image links in the field below instead — you will be
        able to upload the files themselves once it is, and nothing you enter now is wasted.
      </div>
    );
  }

  if (!artworkId) {
    return (
      <div className="border-line/70 text-muted border border-dashed p-6 text-sm leading-relaxed">
        Save this work first, then add photographs to it. That way an image is never uploaded
        against a work that does not exist.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="border-line-strong text-heading caps hover:border-accent hover:text-accent border px-5 py-2 text-sm transition-colors"
        >
          Choose images
        </button>
        <span className="text-muted text-xs">
          JPEG, PNG or WebP. Up to {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB each.
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        multiple
        // `capture` is deliberately absent: on a phone this lets the artist
        // pick from their library as well as take a photograph.
        onChange={(event) => handleFiles(event.target.files)}
        className="sr-only"
      />

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((image) => (
            <li key={image.key} className="border-line/70 flex flex-col gap-2 border p-2">
              <div className="bg-surface relative aspect-4/5 overflow-hidden">
                {image.previewUrl ? (
                  /*
                   * A blob: URL for a file the browser already holds. next/image
                   * would try to optimise it through the server, which cannot
                   * see it — so a plain img is correct here, not a shortcut.
                   */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-muted flex h-full items-center justify-center text-xs">
                    No preview
                  </div>
                )}
              </div>

              {image.error ? (
                <p role="alert" className="text-danger text-xs leading-snug">
                  {image.error}
                </p>
              ) : image.done ? (
                <p className="text-accent text-xs">Uploaded</p>
              ) : (
                <div
                  role="progressbar"
                  aria-valuenow={image.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Uploading ${image.file.name}`}
                  className="bg-surface h-1 w-full"
                >
                  <div
                    className="bg-accent h-full transition-[width] duration-200"
                    style={{ width: `${image.progress}%` }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => handleRemove(image)}
                className="text-muted hover:text-danger caps self-start text-xs"
              >
                {image.done ? 'Remove' : 'Discard'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
