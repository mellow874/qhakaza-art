/**
 * Says, unmissably, that what follows was written to fill the page.
 *
 * Placeholder text a reader cannot tell apart from the real thing is how a
 * demonstration becomes a liability: someone quotes it, or relies on it, and
 * it was never Qhakaza's position. Rendered wherever demo rows are published,
 * and it disappears on its own the moment the last one is replaced.
 */
export function DemoNotice({ what }: { what: string }) {
  return (
    <p
      role="note"
      className="border-accent bg-accent/5 text-body mb-10 border-l-2 py-3 pl-5 text-sm leading-relaxed"
    >
      <strong className="text-heading">Placeholder content.</strong> {what} shown here was written
      by the development team so this page is not empty during a demonstration. It is not
      Qhakaza&rsquo;s wording and should not be relied on.
    </p>
  );
}
