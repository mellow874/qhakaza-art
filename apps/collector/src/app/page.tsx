import { redirect } from 'next/navigation';

/**
 * The Collector Platform's front door.
 *
 * Its public shell lives under `/collectors`, so the bare origin had nothing to
 * serve and returned a 404 — confusing for anyone who simply opens the app.
 * A redirect rather than a copy of the landing page, so there is one canonical
 * URL for it and no duplicate content.
 */
export default function RootPage() {
  redirect('/collectors');
}
