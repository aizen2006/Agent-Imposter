import { useMemo, useSyncExternalStore } from "react";
import type { Match } from "./match";

/* Hands a generated match from the lobby to the match page.

   The server keeps nothing between requests, so the match has to travel with
   the user. sessionStorage rather than a URL or a context: it survives a
   reload of /game/[id], stays in the one tab, and is gone when the tab is.

   A few hundred KB per match against a multi-MB quota, and old matches are
   swept on write, so this cannot grow into a problem over a demo session. */

export type Handoff = {
  id: string;
  marketId: string;
  frames: Match[];
  durations: number[];
  ticket: string | null;
  brain: string;
  market: { open: boolean; hash?: string; reason?: string };
};

const key = (id: string) => `imposter:match:${id}`;

export function stash(h: Handoff): void {
  try {
    // Only the newest match is ever replayed; keeping the rest wastes quota.
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith("imposter:match:")) sessionStorage.removeItem(k);
    }
    sessionStorage.setItem(key(h.id), JSON.stringify(h));
  } catch {
    // Private mode, disabled storage, quota. The caller falls back to showing
    // the "this match is gone" state, which is honest.
  }
}

/* sessionStorage is an external store, so it is read with the primitive meant
   for one rather than assigned into state from an effect. That also gets SSR
   right: the server snapshot is null, and `ready` stays false until hydration,
   so a real match never flashes the "gone" screen on its way in. */

const noSubscribe = () => () => {};

export function useHandoff(id: string): { ready: boolean; match: Handoff | null } {
  const raw = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return sessionStorage.getItem(key(id));
      } catch {
        return null;
      }
    },
    () => null,
  );

  const ready = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

  const match = useMemo(() => (raw ? (JSON.parse(raw) as Handoff) : null), [raw]);
  return { ready, match };
}
