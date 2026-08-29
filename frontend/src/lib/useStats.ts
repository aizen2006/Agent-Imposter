"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

/* One fetch of /api/stats, shared by the home page, lobby and leaderboard.

   Deliberately not react-query: this is one endpoint with one shape, polled
   slowly, and every surface renders an honest empty state when it is missing.
   Nothing here is allowed to throw — an unreachable RPC should cost you a
   number on a page, not the page. */

export type Bettor = {
  address: string;
  staked: number;
  onWinner: number;
  /** Still claimable now — zero once collected. Drives the Claim button. */
  payout: number;
  /** What the position was worth, whether or not it has been collected. */
  won: number;
  claimed: boolean;
};

export type GameStat = {
  id: string;
  numericId: string;
  startedAt: number;
  resolved: boolean;
  abandoned: boolean;
  imposterId: number | null;
  totalPool: number;
  pools: number[];
  bettors: Bettor[];
};

export type LeaderRow = {
  address: string;
  staked: number;
  returned: number;
  net: number;
  games: number;
  hits: number;
  hitRate: number;
  best: number;
};

export type Stats = {
  games: GameStat[];
  leaders: LeaderRow[];
  totals: { openMarkets: number; staked: number; resolved: number; players: number };
  agents: { index: number; timesImposter: number; caught: number }[];
};

export const EMPTY: Stats = {
  games: [],
  leaders: [],
  totals: { openMarkets: 0, staked: 0, resolved: 0, players: 0 },
  agents: Array.from({ length: 6 }, (_, index) => ({ index, timesImposter: 0, caught: 0 })),
};

/* A ticking clock.

   Reading Date.now() during render is impure, and a countdown rendered once
   never counts down. useSyncExternalStore is the sanctioned way to read a
   moving external value: the snapshot is quantised to the tick interval so it
   is stable between ticks (React requires that), and the server snapshot is a
   fixed 0 so hydration cannot mismatch. Callers treat 0 as "not known yet". */
export function useNow(everyMs = 1000): number {
  const store = useMemo(
    () => ({
      subscribe: (cb: () => void) => {
        const t = setInterval(cb, everyMs);
        return () => clearInterval(t);
      },
      snapshot: () => Math.floor(Date.now() / everyMs) * everyMs,
    }),
    [everyMs],
  );

  return useSyncExternalStore(store.subscribe, store.snapshot, () => 0);
}

export function useStats(pollMs = 20000): {
  stats: Stats;
  loading: boolean;
  refresh: () => void;
} {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Stats;
        if (!cancelled) setStats(data);
      } catch {
        // Keep whatever we last had rather than blanking the page.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const t = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pollMs, nonce]);

  /** Pull again now — used after a claim confirms, so the row updates rather
      than waiting out the poll. */
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { stats, loading, refresh };
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const mon = (n: number, dp = 2) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(dp);
export const ago = (ms: number) => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};
