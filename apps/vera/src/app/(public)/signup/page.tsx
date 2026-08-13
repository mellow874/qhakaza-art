import type { Metadata } from 'next';
import Link from 'next/link';

import { NarrowPage, PageHeader } from '@/components/page-shell';
import { signUp } from '@/features/auth/signup-actions';
import { SignUpForm } from '@/features/auth/signup-form';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create an artist account with Qhakaza Art Collective.',
};

export default function SignUpPage() {
  return (
    <NarrowPage className="max-w-md">
      <PageHeader
        eyebrow="Join Qhakaza"
        title="Create your artist account"
        intro="Build your profile, submit work, and follow it through vetting."
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
