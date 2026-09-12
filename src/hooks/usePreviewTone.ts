import { useCallback, useEffect, useRef, useState } from 'react';
import { clampToneLevel } from '../constants/safety';
import { useBle } from '../context/BleContext';

/**
 * Plays one short, fixed-duration tone burst at a time — no ramp, no
 * discomfort-seeking behavior. Used by the pitch/loudness matching flow
 * (`PitchMatchTest`), which only ever presents brief comparison tones at a
 * fixed, comfortable, capped level.
 *
 * Safety invariants (do not weaken):
 * - Every level passes through clampToneLevel().
 * - Callers must keep burst durations well under the firmware's 3s
 *   TONE_LEVEL keep-alive watchdog (see docs/safety.md) — a single
 *   TONE_START/TONE_STOP pair per burst, no ramp, means no keep-alive is
 *   needed as long as the duration stays short (MATCH_BURST_DURATION_MS).
 * - Tones refuse to start unless the BLE link is connected, and are killed
 *   on link loss / unmount, exactly like useLdlTone.
 */
export function usePreviewTone() {
  const { status, sendPayload } = useBle();

  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      sendPayload({ type: 'TONE_STOP' });
    }
  }, [sendPayload]);

  const play = useCallback(
    (f0: number, levelDb: number, durationMs: number, onDone?: () => void): boolean => {
      if (status !== 'connected') return false;
      if (playingRef.current) stop();

      playingRef.current = true;
      setPlaying(true);
      sendPayload({ type: 'TONE_START', f0, level_db: clampToneLevel(levelDb) });

      stopTimer.current = setTimeout(() => {
        stop();
        onDone?.();
      }, durationMs);
      return true;
    },
    [status, sendPayload, stop],
  );

  // Kill the tone the instant the link drops.
  useEffect(() => {
    if (status !== 'connected' && playingRef.current) stop();
  }, [status, stop]);

  // Kill the tone if the screen unmounts for any reason.
  useEffect(() => {
    return () => {
      if (playingRef.current) stop();
    };
  }, [stop]);

  return { playing, play, stop };
}
