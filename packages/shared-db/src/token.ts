import { createHash } from 'node:crypto';

/**
 * The one-way fingerprint of an invitation token.
 *
 * Invitation links are stored only as this digest. A stolen database therefore
 * yields no working links — and, as a direct consequence, nothing anywhere can
 * reproduce a link once it has been shown, which is why "resend the same
 * invitation" is impossible by design rather than by omission.
 *
 * WHY IT LIVES IN shared-db RATHER THAN shared-auth
 * `shared-auth` already imports `shared-db`, so the reverse import would be a
 * cycle. Both packages need this function — auth to validate a token at the
 * door, the invitation lifecycle to look one up — and two copies of a hashing
 * function that must agree exactly is the kind of duplication that eventually
 * stops agreeing. `shared-auth/guards` re-exports this, so the public API is
 * unchanged and there is exactly one implementation.
 *
 * Plain SHA-256, not bcrypt: the input is 32 bytes of cryptographic randomness,
 * not a human-chosen password, so there is nothing to brute-force and a slow
 * hash would only make every door check slower.
 */
export function fingerprintToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
