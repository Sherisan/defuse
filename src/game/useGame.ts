import { useCallback, useEffect, useRef, useState } from 'react';
import type { DefuseApi, Snapshot } from './engine';
import { sound } from './sound';

export type Phase = 'loading' | 'idle' | 'live' | 'ended';

/** Minimum time a wire spends "being cut" before the result shows, for suspense. */
const CUT_SUSPENSE_MS = 420;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useGame(api: DefuseApi) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [cutting, setCutting] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [boomKey, setBoomKey] = useState(0);
  const [scanKey, setScanKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const resultTimer = useRef<number>();

  useEffect(() => {
    api.init().then(setSnap, (e: Error) => setError(e.message));
  }, [api]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3200);
    return () => clearTimeout(t);
  }, [error]);

  const run = useCallback(async (call: () => Promise<Snapshot>, minMs = 0) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    try {
      const [next] = await Promise.all([call(), wait(minMs)]);
      setSnap(next);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  /** Sounds and effects for a round that just ended, then the result card. */
  const finish = useCallback((next: Snapshot) => {
    const status = next.round?.status;
    if (!status || status === 'live') return;
    if (status === 'exploded') {
      sound.boom();
      setBoomKey((k) => k + 1);
    } else if (status === 'defused') sound.defuse();
    else sound.cash();
    clearTimeout(resultTimer.current);
    resultTimer.current = window.setTimeout(() => setShowResult(true), status === 'exploded' ? 1100 : 450);
  }, []);

  const bet = useCallback(
    async (amount: number) => {
      clearTimeout(resultTimer.current);
      const next = await run(() => api.bet(amount));
      if (next) {
        setShowResult(false);
        sound.arm();
      }
    },
    [api, run],
  );

  const cut = useCallback(
    async (wire: number) => {
      if (busyRef.current) return;
      setCutting(wire);
      sound.snip();
      const next = await run(() => api.cut(wire), CUT_SUSPENSE_MS);
      setCutting(null);
      if (!next) return;
      if (next.round?.status === 'live') sound.safe();
      else finish(next);
    },
    [api, run, finish],
  );

  const tip = useCallback(async () => {
    const next = await run(() => api.tip(), 650);
    if (!next) return;
    setScanKey((k) => k + 1);
    sound.scan();
    finish(next);
  }, [api, run, finish]);

  const cashOut = useCallback(async () => {
    const next = await run(() => api.cashOut());
    if (next) finish(next);
  }, [api, run, finish]);

  const setClientSeed = useCallback((seed: string) => run(() => api.setClientSeed(seed)), [api, run]);
  const refill = useCallback(() => (api.refill ? run(api.refill) : null), [api, run]);
  const dismissResult = useCallback(() => setShowResult(false), []);

  const round = snap?.round ?? null;
  const phase: Phase = !snap ? 'loading' : !round ? 'idle' : round.status === 'live' ? 'live' : 'ended';

  return {
    snap,
    round,
    phase,
    busy,
    cutting,
    showResult,
    boomKey,
    scanKey,
    error,
    actions: { bet, cut, tip, cashOut, setClientSeed, refill, dismissResult },
  };
}

export type Game = ReturnType<typeof useGame>;
