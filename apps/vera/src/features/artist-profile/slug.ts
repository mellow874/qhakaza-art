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
 * The slugs to try, in order: `base`, `base-2`, `base-3`…
 *
 * The caller attempts the insert with each in turn and moves on when the unique
 * constraint rejects it. That replaces an earlier "ask whether it is taken, then
 * insert" version, which was wrong in two ways:
 *
 *  - **Racy.** Two artists onboarding at the same moment could both be told a
 *    slug was free and both try to take it.
 *  - **Blind under RLS.** An artist may only read their own row, so the check
 *    reported every other artist's slug as free.
 *
 * The unique index is the only thing that actually knows, so it is what decides.
 */
export function slugCandidates(displayName: string, limit = 25): string[] {
  const base = slugify(displayName);
  return [base, ...Array.from({ length: limit - 1 }, (_, index) => `${base}-${index + 2}`)];
}
