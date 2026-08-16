'use client';

import { useRef, useState } from 'react';

import { Button } from '@qhakaza/shared-ui';

import { privateNote } from '@/content/private-note';

/**
 * Background music for the Private Note.
 *
 * OPT-IN, NEVER AUTOPLAY. Browsers block un-muted autoplay, so an autoplaying
 * page would sit silent and simply look broken - and music that starts without
 * being asked for is hostile on a page someone opened from an email.
 *
 * PLAY/PAUSE AND MUTE ARE SEPARATE CONTROLS. They are different intentions:
 * pause stops the track, mute silences it while it keeps running. The brief
 * asks for mute specifically, and collapsing the two would mean unmuting
 * restarted the piece from the beginning.
 *
 * STATE PERSISTS FOR THE SESSION. Someone who muted the music on one page has
 * said what they want; asking again on the next page is not a fresh question.
 * sessionStorage rather than localStorage, so the preference lasts the visit
 * and not forever.
 *
 * A FAILED LOAD NEVER BREAKS THE PAGE. Every failure path ends in a quiet
 * message and a perfectly usable note.
 */

const PLAY_KEY = 'qhakaza.audio.playing';
const MUTE_KEY = 'qhakaza.audio.muted';

export function AmbientAudio() {
  const { src, title, placeholder, placeholderNote, isPlaceholder, play, pause, mute, unmute } =
    privateNote.audio;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  /*
   * Read the session's preference.
   *
   * Deliberately NOT in an effect. The mute control only exists once playback
   * has started, so nothing on first paint depends on this - which means it can
   * be read at the moment play is pressed instead. That avoids a setState in an
   * effect body, and avoids the hydration mismatch a lazy initialiser would
   * cause by reading sessionStorage during render on the client but not the
   * server.
   *
   * Playback itself is never auto-resumed: a browser refuses an un-prompted
   * play() anyway, and a page that started making noise because of something
   * you did three pages ago is worse than one that waits to be asked.
   */
  function storedMute(): boolean {
    try {
      return sessionStorage.getItem(MUTE_KEY) === 'true';
    } catch {
      // Private browsing can refuse sessionStorage entirely. The player works
      // without it; only the preference is forgotten.
      return false;
    }
  }

  function remember(key: string, value: boolean) {
    try {
      sessionStorage.setItem(key, String(value));
    } catch {
      // See above.
    }
  }

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
        remember(PLAY_KEY, false);
      } else {
        // Apply the session's mute preference before the first sound, so
        // someone who muted earlier is not surprised by this page.
        const wasMuted = storedMute();
        element.muted = wasMuted;
        setMuted(wasMuted);

        await element.play();
        setPlaying(true);
        setFailed(false);
        remember(PLAY_KEY, true);
      }
    } catch {
      // Autoplay policy, a missing file, an unsupported codec - the page is
      // still perfectly usable without music, so this never blocks anything.
      setFailed(true);
      setPlaying(false);
    }
  }

  function toggleMute() {
    const element = audioRef.current;
    const next = !muted;

    setMuted(next);
    if (element) element.muted = next;
    remember(MUTE_KEY, next);
  }

  return (
    <div className="border-line/70 flex flex-col gap-2 border px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="caps text-muted">{title}</span>

        <Button type="button" variant="outline" size="sm" onClick={toggle} className="caps">
          {playing ? pause : play}
        </Button>

        {/* Only offered once there is something to silence. */}
        {playing && (
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            className="text-muted hover:text-heading caps text-xs underline-offset-4 hover:underline"
          >
            {muted ? unmute : mute}
          </button>
        )}

        {failed && (
          <span role="status" className="text-muted text-sm italic">
            Music could not play. The note is unaffected.
          </span>
        )}
      </div>

      {/* Said plainly rather than letting someone wonder why silence plays. */}
      {isPlaceholder && <span className="text-muted text-xs italic">{placeholderNote}</span>}

      {/*
        `loop` because it is ambient. No `autoPlay`, deliberately.
        `preload="none"` so a page nobody asks music from costs no bandwidth,
        which matters on a mobile connection.
      */}
      <audio
        ref={audioRef}
        src={src}
        loop
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
      />
    </div>
  );
}
