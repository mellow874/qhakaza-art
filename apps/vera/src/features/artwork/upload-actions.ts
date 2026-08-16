'use server';

import { auth } from '@qhakaza/shared-auth/server';
import { prisma, withActor } from '@qhakaza/shared-db';
import {
  buildStoragePath,
  storageFromEnv,
  storageIsConfigured,
  validateImageUpload,
} from '@qhakaza/shared-storage';

/**
 * Uploading artwork photographs.
 *
 * Three steps, because the browser uploads straight to storage:
 *
 *   1. `requestUpload`  the server checks who is asking, what they are sending,
 *                       reserves a MediaAsset row as PENDING and returns a
 *                       short-lived signed URL.
 *   2. the browser PUTs the bytes to that URL. Nothing passes through Next.js.
 *   3. `confirmUpload`  the server checks the object really arrived and marks
 *                       the row STORED.
 *
 * The PENDING row is the point: a row exists before the bytes do, so an upload
 * that is abandoned halfway leaves a record saying so rather than an orphaned
 * object nobody can account for.
 *
 * NOTHING IS EVER HARD-DELETED. `removeUpload` sets status to DELETED and
 * leaves the object in the bucket, because section 23 requires files to remain
 * retrievable even when the visible record changes.
 */

export type UploadTicket = {
  assetId: string;
  url: string;
  token: string;
  path: string;
  bucket: string;
};

export type UploadResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** The signed-in artist's profile, or null. Every action here needs it. */
async function currentArtist() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== 'ARTIST') return null;

  const artist = await withActor({ role: 'artist', userId }, (tx) =>
    tx.artist.findUnique({ where: { userId }, select: { id: true } }),
  );

  return artist ? { userId, artistId: artist.id } : null;
}

/** Is this artwork this artist's to touch? */
async function ownsArtwork(userId: string, artistId: string, artworkId: string) {
  const artwork = await withActor({ role: 'artist', userId }, (tx) =>
    tx.artwork.findUnique({ where: { id: artworkId }, select: { artistId: true } }),
  );

  return artwork?.artistId === artistId;
}

export async function requestUpload(input: {
  artworkId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<UploadResult<UploadTicket>> {
  const artist = await currentArtist();
  if (!artist) return { ok: false, error: 'You need an artist profile to upload work.' };

  if (!(await ownsArtwork(artist.userId, artist.artistId, input.artworkId))) {
    // Deliberately the same message a missing artwork would give: whether
    // someone else's artwork id exists is not this caller's business.
    return { ok: false, error: 'That work could not be found.' };
  }

  const storage = storageFromEnv();
  if (!storage.configured) {
    return {
      ok: false,
      error:
        'File uploads are not available yet. You can add an image link instead, and upload the ' +
        'file once storage is connected.',
    };
  }

  const check = validateImageUpload(input);
  if (!check.ok) return { ok: false, error: check.error };

  const path = buildStoragePath({
    subjectType: 'Artwork',
    subjectId: input.artworkId,
    contentType: input.contentType,
  });

  const signed = await storage.createUploadUrl(path);
  if (!signed.ok) {
    console.error('createUploadUrl failed', signed.error);
    return { ok: false, error: 'The upload could not be started. Please try again.' };
  }

  const asset = await withActor({ role: 'artist', userId: artist.userId }, (tx) =>
    tx.mediaAsset.create({
      data: {
        subjectType: 'Artwork',
        subjectId: input.artworkId,
        bucket: signed.value.bucket,
        storagePath: path,
        originalFilename: input.filename.slice(0, 255),
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        status: 'PENDING',
        // An artwork photograph becomes public when the work is released.
        // Evidence documents, added in a later phase, default to INTERNAL.
        confidentiality: 'PUBLIC',
        uploadedById: artist.userId,
        createdById: artist.userId,
      },
      select: { id: true },
    }),
  );

  return {
    ok: true,
    value: { assetId: asset.id, ...signed.value },
  };
}

/**
 * Mark an upload complete, having checked it actually arrived.
 *
 * The check matters: without it a client could claim success without ever
 * sending the bytes, and the gallery would show a broken image with a database
 * row insisting everything was fine.
 */
export async function confirmUpload(input: {
  assetId: string;
}): Promise<UploadResult<{ storagePath: string }>> {
  const artist = await currentArtist();
  if (!artist) return { ok: false, error: 'You need an artist profile to upload work.' };

  const asset = await withActor({ role: 'artist', userId: artist.userId }, (tx) =>
    tx.mediaAsset.findUnique({
      where: { id: input.assetId },
      select: { id: true, storagePath: true, bucket: true, uploadedById: true, status: true },
    }),
  );

  if (!asset || asset.uploadedById !== artist.userId) {
    return { ok: false, error: 'That upload could not be found.' };
  }

  if (asset.status === 'STORED') return { ok: true, value: { storagePath: asset.storagePath } };

  const storage = storageFromEnv();
  if (!(await storage.objectExists(asset.storagePath, asset.bucket))) {
    return { ok: false, error: 'The upload did not complete. Please try again.' };
  }

  await withActor({ role: 'artist', userId: artist.userId }, (tx) =>
    tx.mediaAsset.updateMany({
      where: { id: asset.id, status: 'PENDING' },
      data: { status: 'STORED', uploadedAt: new Date() },
    }),
  );

  return { ok: true, value: { storagePath: asset.storagePath } };
}

/** Withdraw an image. The object stays; only the record's status changes. */
export async function removeUpload(input: { assetId: string }): Promise<UploadResult<null>> {
  const artist = await currentArtist();
  if (!artist) return { ok: false, error: 'You need an artist profile to do that.' };

  const { count } = await withActor({ role: 'artist', userId: artist.userId }, (tx) =>
    tx.mediaAsset.updateMany({
      where: { id: input.assetId, uploadedById: artist.userId, status: { not: 'DELETED' } },
      data: { status: 'DELETED', deletedAt: new Date() },
    }),
  );

  return count > 0
    ? { ok: true, value: null }
    : { ok: false, error: 'That upload could not be found.' };
}

/** The stored images for one work, in order, for the artist's own screens. */
export async function listUploads(artworkId: string) {
  const artist = await currentArtist();
  if (!artist) return [];

  return withActor({ role: 'artist', userId: artist.userId }, (tx) =>
    tx.mediaAsset.findMany({
      where: { subjectType: 'Artwork', subjectId: artworkId, status: 'STORED' },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        storagePath: true,
        bucket: true,
        originalFilename: true,
        sizeBytes: true,
        contentType: true,
        uploadedAt: true,
      },
    }),
  );
}

/** Whether uploads are available, so the form can say so rather than guess. */
export async function getStorageStatus(): Promise<{ configured: boolean }> {
  return { configured: storageIsConfigured() };
}
