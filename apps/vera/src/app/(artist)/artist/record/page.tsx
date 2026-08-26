import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  saveAbout,
  saveCvEntry,
  saveExhibition,
  saveLink,
  saveMediums,
  saveRepresentation,
  saveSignal,
  withdrawEntry,
} from '@/features/artist-record/actions';
import { ArtistRecordEditor } from '@/features/artist-record/artist-record';
import { getMyRecord, getVocabularies } from '@/features/artist-record/queries';

export const metadata: Metadata = { title: 'Your record' };

/**
 * The artist's own record.
 *
 * The proxy fences /artist to the ARTIST role, but a server component must not
 * rely on that alone - middleware does not run for every path to this code, so
 * the absence of a record is checked here too.
 */
export default async function ArtistRecordPage() {
  const [record, vocabularies] = await Promise.all([getMyRecord(), getVocabularies()]);

  // No profile yet means onboarding has not happened. Sending them to the
  // record would be a form with nothing to attach itself to.
  if (!record) redirect('/artist/onboarding');

  return (
    <ArtistRecordEditor
      record={record}
      vocabularies={vocabularies}
      onSaveAbout={saveAbout}
      onSaveMediums={saveMediums}
      onSaveExhibition={saveExhibition}
      onSaveRepresentation={saveRepresentation}
      onSaveCvEntry={saveCvEntry}
      onSaveSignal={saveSignal}
      onSaveLink={saveLink}
      onWithdraw={async (kind, input) => {
        'use server';
        // The kind is narrowed on the server rather than trusted from the
        // client: it selects which table is written to.
        const allowed = ['exhibition', 'representation', 'cvEntry', 'signal', 'link', 'medium'];
        if (!allowed.includes(kind)) return { ok: false, error: 'INVALID' };
        return withdrawEntry(kind as 'exhibition', input);
      }}
    />
  );
}
