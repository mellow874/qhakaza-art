import { describe, expect, it } from 'vitest';

import { buildStoragePath, sniffImageType, validateImageUpload } from './paths';
import { MAX_IMAGE_BYTES, UnavailableStorageService, storageFromEnv } from './service';

const MB = 1024 * 1024;

/**
 * A stand-in environment.
 *
 * `NodeJS.ProcessEnv` requires NODE_ENV, so a bare object literal cannot be
 * asserted to it directly. Going through `unknown` keeps these tests reading as
 * the sparse fixtures they are rather than forcing every case to spell out
 * variables it does not care about.
 */
const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe('buildStoragePath', () => {
  it('never uses the name the user supplied', () => {
    // A filename is attacker-controlled text. If it became part of the path,
    // "../" and friends would come with it.
    const path = buildStoragePath({
      subjectType: 'Artwork',
      subjectId: 'ck123',
      contentType: 'image/jpeg',
    });

    expect(path).toMatch(/^artwork\/ck123\/[0-9a-f]{24}\.jpg$/);
  });

  it('gives two uploads of the same file different paths', () => {
    // Two artists both uploading "final.jpg" must not collide.
    const input = {
      subjectType: 'Artwork',
      subjectId: 'ck123',
      contentType: 'image/png',
    } as const;

    expect(buildStoragePath(input)).not.toBe(buildStoragePath(input));
  });

  it('strips anything path-like out of the subject id', () => {
    const path = buildStoragePath({
      subjectType: 'Artwork',
      subjectId: '../../etc/passwd',
      contentType: 'image/png',
    });

    expect(path).not.toContain('..');
    expect(path).not.toContain('etc/passwd');
  });

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('gives %s the extension .%s', (contentType, extension) => {
    const path = buildStoragePath({ subjectType: 'Artwork', subjectId: 'x', contentType });
    expect(path.endsWith(`.${extension}`)).toBe(true);
  });
});

describe('validateImageUpload', () => {
  const valid = { contentType: 'image/jpeg', sizeBytes: 2 * MB, filename: 'work.jpg' };

  it('accepts a normal photograph', () => {
    expect(validateImageUpload(valid)).toEqual({ ok: true });
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', (contentType) => {
    expect(validateImageUpload({ ...valid, contentType }).ok).toBe(true);
  });

  it.each([
    ['a PDF', 'application/pdf'],
    ['an SVG', 'image/svg+xml'],
    ['a GIF', 'image/gif'],
    ['nothing at all', ''],
  ])('refuses %s', (_label, contentType) => {
    // SVG is excluded on purpose: it can carry script, and it would be served
    // from the platform's own origin.
    expect(validateImageUpload({ ...valid, contentType }).ok).toBe(false);
  });

  it('refuses a file over the limit, and says by how much', () => {
    const result = validateImageUpload({ ...valid, sizeBytes: MAX_IMAGE_BYTES + 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/15MB/);
  });

  it('accepts a file exactly at the limit', () => {
    expect(validateImageUpload({ ...valid, sizeBytes: MAX_IMAGE_BYTES }).ok).toBe(true);
  });

  it.each([
    ['an empty file', 0],
    ['a negative size', -1],
    ['a non-number', Number.NaN],
  ])('refuses %s', (_label, sizeBytes) => {
    expect(validateImageUpload({ ...valid, sizeBytes }).ok).toBe(false);
  });

  it('refuses a file with no name', () => {
    expect(validateImageUpload({ ...valid, filename: '   ' }).ok).toBe(false);
  });
});

describe('sniffImageType', () => {
  it('recognises a JPEG by its first bytes', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });

  it('recognises a PNG', () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    );
  });

  it('recognises a WebP', () => {
    const bytes = new Uint8Array(12);
    bytes.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    bytes.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
    expect(sniffImageType(bytes)).toBe('image/webp');
  });

  it('is not fooled by a file that merely claims to be an image', () => {
    // The whole point: a content type is a claim, these bytes are evidence.
    const html = new Uint8Array([...'<html>'].map((c) => c.charCodeAt(0)));
    expect(sniffImageType(html)).toBeNull();
  });

  it('returns null for something too short to identify', () => {
    expect(sniffImageType(new Uint8Array([0xff]))).toBeNull();
  });
});

describe('storageFromEnv', () => {
  it('is unavailable when nothing is configured', () => {
    const storage = storageFromEnv(env({}));

    expect(storage.configured).toBe(false);
    expect(storage).toBeInstanceOf(UnavailableStorageService);
  });

  it('stays unavailable when only half the configuration is present', () => {
    // Half-configured is not configured. Failing here beats failing on upload.
    const storage = storageFromEnv(env({ SUPABASE_URL: 'https://x.supabase.co' }));
    expect(storage.configured).toBe(false);
  });

  it('refuses uploads with a reason rather than throwing', async () => {
    // An uploader that silently discarded files would be far worse than one
    // that says it is unavailable.
    const result = await new UnavailableStorageService().createUploadUrl();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('becomes available once both values are set', () => {
    const storage = storageFromEnv(
      env({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      }),
    );

    expect(storage.configured).toBe(true);
    expect(storage.name).toBe('supabase');
  });
});
