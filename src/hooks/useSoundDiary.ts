import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDiaryMark,
  appendDiaryFrames,
  getDiaryFrames,
  getDiaryMarks,
  undoLastDiaryMark,
} from '../services/SoundDiaryStore';
import { SOUND_CAPTURE_SUPPORTED, startSoundCapture } from '../services/SoundCapture';
import { SoundCaptureHandle } from '../services/soundCaptureTypes';
import { DiaryFrame } from '../utils/soundFeatures';
import { analyzeTriggers, TriggerAnalysis } from '../utils/triggerAnalysis';

const SAVE_EVERY_MS = 60_000;

/**
 * Sound diary controller. Listening is always an explicit, visible choice
 * and stops when the screen goes away. Frames are saved in batches of about
 * a minute so storage is not rewritten every 5 seconds.
 */
export function useSoundDiary(enabled: boolean) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TriggerAnalysis | null>(null);
  const [counts, setCounts] = useState({ hurt: 0, fine: 0 });
  const handle = useRef<SoundCaptureHandle | null>(null);
  const buffer = useRef<DiaryFrame[]>([]);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const [frames, marks] = await Promise.all([getDiaryFrames(), getDiaryMarks()]);
    setCounts({
      hurt: marks.filter((m) => m.kind === 'hurt').length,
      fine: marks.filter((m) => m.kind === 'fine').length,
    });
    setAnalysis(analyzeTriggers(marks, frames));
  }, []);

  const flush = useCallback(async () => {
    const batch = buffer.current;
    buffer.current = [];
    if (batch.length > 0) await appendDiaryFrames(batch);
  }, []);

  const stop = useCallback(async () => {
    handle.current?.stop();
    handle.current = null;
    if (flushTimer.current) clearInterval(flushTimer.current);
    flushTimer.current = null;
    setListening(false);
    await flush();
    await refresh();
  }, [flush, refresh]);

  const start = useCallback(async () => {
    if (!enabled || handle.current) return;
    setError(null);
    try {
      handle.current = await startSoundCapture((frame) => buffer.current.push(frame));
      flushTimer.current = setInterval(() => void flush(), SAVE_EVERY_MS);
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start listening.');
    }
  }, [enabled, flush]);

  /** Save any buffered sound first so the tap lines up with what came before it. */
  const mark = useCallback(
    async (kind: 'hurt' | 'fine') => {
      await flush();
      await addDiaryMark({ timestamp: Date.now(), kind });
      await refresh();
    },
    [flush, refresh],
  );

  const undo = useCallback(async () => {
    await undoLastDiaryMark();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    return () => {
      handle.current?.stop();
      handle.current = null;
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, [refresh]);

  return { supported: SOUND_CAPTURE_SUPPORTED, listening, error, analysis, counts, start, stop, mark, undo };
}
