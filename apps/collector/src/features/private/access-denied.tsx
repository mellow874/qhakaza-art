/**
 * The single response to every failed activation.
 *
 * Deliberately says nothing about *why*. Expired, revoked, forged and
 * wrong-role all render this exact markup, so the page cannot be used to
 * discover whether a guessed token corresponds to a real invitation. The
 * distinction is recorded in ActivationAttempt, where it is useful to us and
 * invisible to whoever is guessing.
 *
 * No membership, artist or artwork data is fetched before this renders — the
 * layout returns here before any of that runs.
 */
export function AccessDenied() {
  return (
    <main className="theme-light bg-canvas text-body flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">Qhakaza Art Collective</p>
      <h1 className="font-display text-heading mt-6 text-3xl sm:text-4xl">
        This link is not valid
      </h1>
      <p className="text-body mt-5 max-w-md leading-relaxed">
        Private access is by invitation. If you were expecting to reach a member area, contact your
        advisor and we will arrange a new link.
      </p>
    </main>
  );
}
