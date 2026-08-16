import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Object storage, without committing to a provider.
 *
 * Same shape as the email layer, for the same reason: the credentials do not
 * exist yet, and nothing should be blocked waiting for them. The default
 * implementation refuses uploads with a clear reason, the UI reports that
 * plainly, and connecting Supabase later is two environment variables.
 *
 * WHY SIGNED UPLOAD URLS RATHER THAN PROXYING THROUGH THE SERVER
 * The browser uploads straight to storage using a short-lived URL the server
 * issues. That keeps the service key on the server, avoids Next.js's server
 * action body limit, and means a 12MB photograph does not occupy a Node process
 * for the duration of the upload. The cost is one extra round trip.
 *
 * THE SERVICE KEY IS SERVER-ONLY. It bypasses every storage policy. It must
 * never be given the `NEXT_PUBLIC_` prefix and must never reach the browser.
 */

/** What the platform will accept. Deliberately narrow. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** 15MB. Comfortably above a phone photograph, below anything pathological. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type SignedUpload = {
  /** Where the browser PUTs the bytes. Short-lived. */
  url: string;
  /** Supabase returns a token that must accompany the upload. */
  token: string;
  /** Where the object will live. Store this on the record. */
  path: string;
  bucket: string;
};

export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface StorageService {
  readonly name: string;
  readonly configured: boolean;

  /** Issue a short-lived URL the browser can upload one object to. */
  createUploadUrl(path: string, bucket?: string): Promise<StorageResult<SignedUpload>>;

  /** A time-limited URL for reading a private object. */
  createReadUrl(path: string, bucket?: string, expiresInSeconds?: number): Promise<StorageResult<string>>;

  /** Confirm an object really arrived, so a record is never marked STORED on trust. */
  objectExists(path: string, bucket?: string): Promise<boolean>;
}

/**
 * The default: storage is not connected.
 *
 * Refuses rather than pretending. An uploader that silently discarded files
 * would be far worse than one that says it is unavailable, and the artist can
 * still supply an image URL, which remains a supported field.
 */
export class UnavailableStorageService implements StorageService {
  readonly name = 'unavailable';
  readonly configured = false;

  private readonly reason =
    'File storage is not connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.';

  async createUploadUrl(): Promise<StorageResult<SignedUpload>> {
    return { ok: false, error: this.reason };
  }

  async createReadUrl(): Promise<StorageResult<string>> {
    return { ok: false, error: this.reason };
  }

  async objectExists(): Promise<boolean> {
    return false;
  }
}

export class SupabaseStorageService implements StorageService {
  readonly name = 'supabase';
  readonly configured = true;

  private readonly client: SupabaseClient;

  constructor(
    url: string,
    serviceRoleKey: string,
    private readonly defaultBucket: string,
  ) {
    this.client = createClient(url, serviceRoleKey, {
      // A server-side client has no user session to persist or refresh, and
      // doing either would be a way for one request's identity to leak into
      // the next.
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async createUploadUrl(path: string, bucket = this.defaultBucket): Promise<StorageResult<SignedUpload>> {
    const { data, error } = await this.client.storage.from(bucket).createSignedUploadUrl(path);

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Could not create an upload URL' };
    }

    return { ok: true, value: { url: data.signedUrl, token: data.token, path, bucket } };
  }

  async createReadUrl(
    path: string,
    bucket = this.defaultBucket,
    expiresInSeconds = 60 * 60,
  ): Promise<StorageResult<string>> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Could not create a read URL' };
    }

    return { ok: true, value: data.signedUrl };
  }

  async objectExists(path: string, bucket = this.defaultBucket): Promise<boolean> {
    // `list` on the parent prefix, because Storage has no cheap "head object".
    const lastSlash = path.lastIndexOf('/');
    const prefix = lastSlash === -1 ? '' : path.slice(0, lastSlash);
    const name = lastSlash === -1 ? path : path.slice(lastSlash + 1);

    const { data, error } = await this.client.storage
      .from(bucket)
      .list(prefix, { search: name, limit: 1 });

    if (error || !data) return false;
    return data.some((entry) => entry.name === name);
  }
}

export const DEFAULT_BUCKET = 'artwork';

/**
 * Pick an implementation from configuration.
 *
 * Falls back to unavailable rather than throwing: not connected is the expected
 * state today, not an error condition.
 */
export function storageFromEnv(env: NodeJS.ProcessEnv = process.env): StorageService {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;

  if (url && key) return new SupabaseStorageService(url, key, bucket);

  return new UnavailableStorageService();
}

/** True when uploads can actually happen. The UI says so plainly either way. */
export function storageIsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
