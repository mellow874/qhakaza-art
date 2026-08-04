const MAX_LENGTH = 60;

/** Turns a display name into a URL-safe storefront slug. */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD') // splits accented characters into letter + combining mark
    .replace(/[̀-ͯ]/g, '') // …then drops the marks
    .toLowerCase()
    .replace(/['’`]/g, '') // "Sipho's" → "siphos", not "sipho-s"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, ''); // the slice may have left a trailing separator

  return slug || 'artist';
}

/**
 * Finds a free slug, trying `base`, `base-2`, `base-3`… in turn.
 *
 * `isTaken` is injected rather than querying directly, which keeps this
 * testable without a database and lets callers scope the check (e.g. excluding
 * the artist's own current slug).
 */
export async function uniqueSlug(
  displayName: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(displayName);

  if (!(await isTaken(base))) return base;

  for (let suffix = 2; suffix < 1_000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(`Could not find a free slug for "${displayName}"`);
}
