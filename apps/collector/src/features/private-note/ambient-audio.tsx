'use client';

import { useRef, useState } from 'react';

import { Button } from '@qhakaza/shared-ui';

import { privateNote } from '@/content/private-note';

/**
 * Background music for the Private Note.
 *
 * OPT-IN, NEVER AUTOPLAY. Browsers block un-muted autoplay, so an autoplaying
 * page would sit silent and simply look broken — and music that starts without
 * being asked for is hostile on a page someone opened from an email.
 *
 * ⚠ NO AUDIO FILE HAS BEEN SUPPLIED. `privateNote.audio.src` is null, and this
 * renders a clearly-labelled unavailable state rather than a control that does
 * nothing or an <audio> pointing at a 404. Add the track, set `src`, and the
 * player becomes live with no other change.
 */
export function AmbientAudio() {
  const { src, title, placeholder, play, pause } = privateNote.audio;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src) {
    return (
      <div className="border-line/70 text-muted flex flex-wrap items-center gap-3 border px-5 py-4">
        <span className="caps">{title}</span>
        <span className="text-sm italic">{placeholder}</span>
      </div>
    );
  }

  async function toggle() {
    const element = audioRef.current;
    if (!element) return;

    try {
      if (playing) {
        element.pause();
        setPlaying(false);
      } else {
        await element.play();
        setPlaying(true);
      }
    } catch {
      // Autoplay policy, a missing file, an unsupported codec — the page is
      // still perfectly usable without music, so this never blocks anything.
      setFailed(true);
      setPlaying(false);
    }
  }

  return (
    <div className="border-line/70 flex flex-wrap items-center gap-4 border px-5 py-4">
      <span className="caps text-muted">{title}</span>

      <Button type="button" variant="outline" size="sm" onClick={toggle} className="caps">
        {playing ? pause : play}
      </Button>

      {failed && (
        <span role="status" className="text-muted text-sm italic">
          Music could not play. The note is unaffected.
        </span>
      )}

      {/* `loop` because it is ambient; no `autoPlay`, deliberately. */}
      <audio ref={audioRef} src={src} loop preload="none" onEnded={() => setPlaying(false)} />
    </div>
  );
}
