/**
 * Placeholder for a route that exists but whose screen has not been designed yet.
 *
 * Phase 0 only builds the skeleton: routing, auth fencing and data models. Each
 * of these is replaced by a real screen as its design arrives in Phase 1–3.
 */
export function PhaseZeroStub({ title, area }: { title: string; area: string }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-3 px-6 py-24">
      <p className="text-muted text-xs tracking-[0.2em] uppercase">{area}</p>
      <h1 className="text-4xl">{title}</h1>
      <p className="text-muted text-sm">
        Route scaffolded in Phase 0. The screen is built when its design is provided.
      </p>
    </main>
  );
}
