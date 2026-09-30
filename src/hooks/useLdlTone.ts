import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampToneLevel,
  LDL_MAX_TONE_DURATION_MS,
  LDL_RAMP_INTERVAL_MS,
  LDL_RAMP_STEP_DB,
  LDL_START_LEVEL_DB,
  MAX_TONE_LEVEL_DB,
} from '../constants/safety';
import { useBle } from '../context/BleContext';
import { hearingTestsAllowed } from '../utils/deviceMessages';

export type ToneState = 'idle' | 'ramping' | 'held-at-cap';

export interface ToneStopInfo {
  levelDb: number;
  /** True when the ramp reached MAX_TONE_LEVEL_DB without a user stop. */
  cappedOut: boolean;
  /**
   * True when the *device* ended the tone on its own (its keep-alive
   * watchdog fired, `{"event":"tone_watchdog"}`). The ramp was cut off for a
   * non-user reason, so the step has no result — callers must not record one.
   */
  aborted?: boolean;
}

/**
 * Owns one test tone at a time: start → slow upward ramp → stop.
 *
 * Safety invariants (do not weaken):
 * - Every level sent to the device passes through clampToneLevel().
 * - The ramp never exceeds MAX_TONE_LEVEL_DB — it parks there and reports it.
 * - A hardware TONE_STOP fires on: user stop, cap timeout,
 *   LDL_MAX_TONE_DURATION_MS fail-safe, BLE link loss, and unmount.
 * - Tones refuse to start unless the BLE link is currently connected, so a
 *   stale TONE_START can never replay from the offline queue.
 * - Tones refuse to start when the connected firmware announced a DAC path
 *   without the output limiter (boot event, utils/deviceMessages.ts).
 * - A `tone_watchdog` event from the device is treated as an external stop:
 *   timers cleared, state idle, the step reported as aborted (no result).
 * - TONE_* acks echo the level the device actually applied; the meter shows
 *   that value, never a requested one the firmware clamped down.
 */
export function useLdlTone() {
  const { status, sendPayload, deviceInfo, onDeviceMessage } = useBle();

  const [toneState, setToneState] = useState<ToneState>('idle');
  const [levelDb, setLevelDb] = useState(LDL_START_LEVEL_DB);

  const rampTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const failSafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelRef = useRef(LDL_START_LEVEL_DB);
  const stateRef = useRef<ToneState>('idle');
  const onCapRef = useRef<((info: ToneStopInfo) => void) | null>(null);

  const clearTimers = useCallback(() => {
    if (rampTimer.current) clearInterval(rampTimer.current);
    if (failSafeTimer.current) clearTimeout(failSafeTimer.current);
    rampTimer.current = null;
    failSafeTimer.current = null;
  }, []);

  const stop = useCallback((): ToneStopInfo => {
    clearTimers();
    const info: ToneStopInfo = {
      levelDb: levelRef.current,
      cappedOut: stateRef.current === 'held-at-cap',
    };
    stateRef.current = 'idle';
    setToneState('idle');
    sendPayload({ type: 'TONE_STOP' });
    return info;
  }, [clearTimers, sendPayload]);

  const start = useCallback(
    (f0: number, onAutoStop: (info: ToneStopInfo) => void): boolean => {
      // Never start a tone that would sit in the offline queue and replay later.
      if (status !== 'connected') return false;
      // Never play a test tone through a build with no limiter in the path.
      if (!hearingTestsAllowed(deviceInfo)) return false;
      if (stateRef.current !== 'idle') stop();

      const startLevel = clampToneLevel(LDL_START_LEVEL_DB);
      levelRef.current = startLevel;
      setLevelDb(startLevel);
      stateRef.current = 'ramping';
      setToneState('ramping');
      onCapRef.current = onAutoStop;

      sendPayload({ type: 'TONE_START', f0, level_db: startLevel });

      rampTimer.current = setInterval(() => {
        const next = clampToneLevel(levelRef.current + LDL_RAMP_STEP_DB);
        levelRef.current = next;
        setLevelDb(next);

        if (next >= MAX_TONE_LEVEL_DB) {
          // Park at the ceiling briefly, then auto-stop: "no discomfort up
          // to the safe limit" is itself a valid result.
          clearTimers();
          stateRef.current = 'held-at-cap';
          setToneState('held-at-cap');
          sendPayload({ type: 'TONE_LEVEL', level_db: next });
          failSafeTimer.current = setTimeout(() => {
            onCapRef.current?.(stop());
          }, LDL_RAMP_INTERVAL_MS * 3);
          return;
        }
        sendPayload({ type: 'TONE_LEVEL', level_db: next });
      }, LDL_RAMP_INTERVAL_MS);

      // Absolute fail-safe, independent of the ramp logic above.
      failSafeTimer.current = setTimeout(() => {
        onCapRef.current?.(stop());
      }, LDL_MAX_TONE_DURATION_MS);

      return true;
    },
    [status, deviceInfo, sendPayload, stop, clearTimers],
  );

  // Device → app messages: the watchdog abort and the applied-level echo.
  useEffect(() => {
    const sub = onDeviceMessage((message) => {
      if (stateRef.current === 'idle') return;

      if (message.kind === 'event' && message.event === 'tone_watchdog') {
        // The device has already silenced itself; do not send TONE_STOP (it
        // would only be acked) — just fall silent on our side and report it.
        clearTimers();
        const info: ToneStopInfo = { levelDb: levelRef.current, cappedOut: false, aborted: true };
        stateRef.current = 'idle';
        setToneState('idle');
        onCapRef.current?.(info);
        return;
      }

      if (
        message.kind === 'ack' &&
        message.ok &&
        (message.cmd === 'TONE_START' || message.cmd === 'TONE_LEVEL') &&
        message.levelDb !== levelRef.current
      ) {
        // The firmware clamped (or rounded) what we sent: show what is
        // actually playing. Its ceiling can only ever be at or below ours.
        const applied = clampToneLevel(message.levelDb);
        levelRef.current = applied;
        setLevelDb(applied);
      }
    });
    return () => sub.remove();
  }, [onDeviceMessage, clearTimers]);

  // Kill the tone the instant the link drops mid-test.
  useEffect(() => {
    if (status !== 'connected' && stateRef.current !== 'idle') {
      stop();
    }
  }, [status, stop]);

  // Kill the tone if the screen unmounts for any reason.
  useEffect(() => {
    return () => {
      if (stateRef.current !== 'idle') stop();
    };
  }, [stop]);

  return { toneState, levelDb, start, stop };
}
