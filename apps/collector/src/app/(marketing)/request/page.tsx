import { redirect } from 'next/navigation';

/**
 * The private request form arrived on two routes, `/request` and
 * `/collectors/request`, rendering byte-identical pages. Everything else this
 * site serves is namespaced under `/collectors`, so that is the canonical one
 * and this redirects to it.
 *
 * Kept as a redirect rather than deleted: the bare path may already have been
 * shared, and a redirect costs nothing while a 404 costs a request.
 */
export default function RequestPage() {
  redirect('/collectors/request');
}
