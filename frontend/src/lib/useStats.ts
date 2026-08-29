"use client";

import { useEffect, useState } from "react";

/* One fetch of /api/stats, shared by the home page, lobby and leaderboard.

   Deliberately not react-query: this is one endpoint with one shape, polled
   slowly, and every surface renders an honest empty state when it is missing.
   Nothing here is allowed to throw — an unreachable RPC should cost you a
   number on a page, not the page. */

export type GameStat = {
  id: string;
  numericId: string;
  startedAt: number;
  resolved: boolean;
  abandoned: boolean;
  imposterId: number | null;
  totalPool: number;
  pools: number[];
  bettors: { address: string; staked: number; onWinner: number; payout: number }[];
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

export function useStats(pollMs = 20000): { stats: Stats; loading: boolean } {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

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
  }, [pollMs]);

  return { stats, loading };
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
