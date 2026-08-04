import type { Metadata } from 'next';

import { NarrowPage, PageHeader } from '@/components/page-shell';
import { ArtistOnboarding } from '@/features/artist-profile/artist-onboarding';
import { getMyArtistProfile } from '@/features/artist-profile/actions';

export const metadata: Metadata = { title: 'Set up your storefront' };

export default async function ArtistOnboardingPage() {
  // Server-side read. The proxy already fenced this route, but this call
  // re-checks the session itself — the fence is a convenience, not the boundary.
  const profile = await getMyArtistProfile();

  return (
    <NarrowPage>
      <PageHeader
        eyebrow={profile ? 'Your storefront' : 'Step 1 of 2'}
        title={profile ? 'Edit your storefront' : 'Set up your storefront'}
        intro={
          profile
            ? 'Update how collectors see you. Your storefront address stays the same.'
            : 'Tell collectors who you are. You can refine all of this later — nothing here is final.'
        }
        className="mb-12"
      />

      <ArtistOnboarding
        profile={
          profile
            ? {
                displayName: profile.displayName,
                statement: profile.statement,
                socials: (profile.socials as Record<string, string> | null) ?? null,
              }
            : undefined
        }
      />
    </NarrowPage>
  );
}
