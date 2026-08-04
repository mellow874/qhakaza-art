'use client';

import { useRouter } from 'next/navigation';

import { saveArtistProfile } from './actions';
import { ArtistProfileForm, type ArtistProfileValues } from './artist-profile-form';

type Props = {
  profile?: {
    displayName: string;
    statement?: string | null;
    socials?: Record<string, string> | null;
  };
};

/**
 * Connects the profile form to the server action and moves the artist on once
 * the save succeeds. Kept separate so the form itself stays a pure, easily
 * testable component with no routing or server dependencies.
 */
export function ArtistOnboarding({ profile }: Props) {
  const router = useRouter();

  async function handleSave(values: ArtistProfileValues) {
    const result = await saveArtistProfile(values);

    if (result.ok) {
      router.push('/artist/dashboard');
      router.refresh();
    }

    return result;
  }

  return <ArtistProfileForm profile={profile} onSave={handleSave} />;
}
