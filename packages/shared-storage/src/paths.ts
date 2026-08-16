import { randomBytes } from 'node:crypto';

import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './service';

/**
 * Deciding where an object lives, and whether it is allowed at all.
 *
 * Separate from the service so it can be tested without a storage provider,
 * and so the same rules apply whichever provider is behind it.
 */

/**
 * Build the storage path for an upload.
 *
 * THE PATH IS GENERATED, NOT THE FILENAME THE USER GAVE. Two artists both
 * uploading "final.jpg" must not collide, and a filename is attacker-controlled
 * text that would otherwise become part of a path — "../" and friends. The
 * original name is kept in the database column that exists for it.
 *
 * Shape: subject/subjectId/random.extension
 *   artwork/ckx123.../9f2b1c4e8a7d.jpg
 */
export function buildStoragePath(input: {
  subjectType: string;
  subjectId: string;
  contentType: string;
}): string {
  const folder = input.subjectType.toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = input.subjectId.replace(/[^A-Za-z0-9_-]/g, '');
  const extension = extensionFor(input.contentType);
  const unique = randomBytes(12).toString('hex');

  return `${folder}/${id}/${unique}.${extension}`;
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

export type UploadRejection = { ok: false; error: string };
export type UploadAcceptance = { ok: true };

/**
 * Whether an upload may proceed, judged on what the browser claims.
 *
 * THIS IS NOT SUFFICIENT ON ITS OWN. A content type is whatever the client
 * says it is. It is checked here so an obviously wrong file is refused before
 * anything is issued, and checked again against the object's real bytes after
 * upload. Treat this as courtesy to honest users, not as a security boundary.
 */
export function validateImageUpload(input: {
  contentType: string;
  sizeBytes: number;
  filename: string;
}): UploadAcceptance | UploadRejection {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(input.contentType)) {
    return {
      ok: false,
      error: `That file type is not accepted. Use a JPEG, PNG or WebP image.`,
    };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: 'That file appears to be empty.' };
  }

  if (input.sizeBytes > MAX_IMAGE_BYTES) {
    const limit = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
    const actual = (input.sizeBytes / (1024 * 1024)).toFixed(1);
    return { ok: false, error: `That image is ${actual}MB. The limit is ${limit}MB.` };
  }

  if (!input.filename.trim()) {
    return { ok: false, error: 'That file has no name.' };
  }

  return { ok: true };
}

/**
 * The first bytes of a file, and what they say it really is.
 *
 * The magic numbers, because a content type is a claim. Used after upload to
 * confirm a file called `photo.jpg` and declared `image/jpeg` is actually a
 * JPEG rather than something else wearing the name.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) {
    return 'image/png';
  }

  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}
