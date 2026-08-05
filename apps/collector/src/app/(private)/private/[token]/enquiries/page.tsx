import { submitEnquiry } from '@/features/private/enquiry-actions';
import { EnquiryForm } from '@/features/private/enquiry-form';

export default async function EnquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ artwork?: string }>;
}) {
  const { token } = await params;
  const { artwork } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-20">
      <p className="eyebrow">Private enquiry</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">Speak to your advisor</h1>
      <p className="text-body mt-6 max-w-2xl leading-relaxed">
        Ask about a work, request a viewing, or raise anything you would like prepared before your
        next conversation.
      </p>

      <div className="mt-14">
        {/* The artwork id is passed through untrusted and re-checked against
            released work in the action — a crafted link cannot attach an
            enquiry to a draft. */}
        <EnquiryForm token={token} artworkId={artwork} onSubmit={submitEnquiry} />
      </div>
    </main>
  );
}
