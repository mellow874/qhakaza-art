import type { Metadata } from 'next';
import Link from 'next/link';

import { NarrowPage, PageHeader } from '@/components/page-shell';
import { signUp } from '@/features/auth/signup-actions';
import { SignUpForm } from '@/features/auth/signup-form';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Join Qhakaza Art Collective as an artist or a collector.',
};

export default function SignUpPage() {
  return (
    <NarrowPage className="max-w-md">
      <PageHeader
        eyebrow="Join Qhakaza"
        title="Create an account"
        intro="Artists build a profile and submit work. Collectors sign in here before opening an invitation to the Collector Intelligence Suite."
        className="mb-10"
      />

      <SignUpForm onSubmit={signUp} />

      <p className="text-muted mt-10 text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-accent underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </NarrowPage>
  );
}
