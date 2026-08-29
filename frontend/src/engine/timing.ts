import type { GameEvent } from "./types";

/* Playback timing (prd.md §7.1, §16).

   Shared by the live match and the golden-game fallback. It lives here rather
   than in a route because the fallback exists to look identical to the real
   thing — if the two tables drifted, the safety net would replay at a
   different rhythm than everything you rehearsed. */

export const DELAY: Record<GameEvent["t"], number> = {
  GAME_STARTED: 400,
  AGENT_MOVED: 600,
  TASK_DONE: 900,
  SABOTAGE: 1600,
  KILL: 1800, // let it land
  BODY_FOUND: 1800,
  MEETING_START: 1200,
  SAID: 1400,
  VOTE: 400,
  ELIMINATED: 2500, // the reveal beat
  NO_ELIMINATION: 1600,
  RESOLVED: 2000,
};

export const clampSpeed = (n: number) => Math.min(8, Math.max(0.25, Number(n) || 1));

/* The doors-open period before a match begins.

   Without it a match started playing the instant it was created, and the
   reveal ~80s later hard-closed betting — so a second person had to find the
   game and stake inside eighty seconds of a button press they had no warning
   of. That is not a market, it is a coincidence.

   Now: create -> announce -> countdown -> everyone starts together. Playback
   position is a pure function of wall clock against startAt, so every viewer
   is on the same frame without anything being synchronised over a wire. */
export const LOBBY_MS = Number(process.env.NEXT_PUBLIC_LOBBY_MS ?? 90_000);

/* A held beat after each vote lands, before the next round starts.

   Continuous playback ran the whole match in ~80 seconds, which is exciting to
   watch and nearly impossible to bet on: by the time you have read an argument
   and decided it was a lie, the round has moved on. The evidence arrives at
   the ejection, so that is where the pause belongs — new information, then
   time to act on it, then the next round.

   The pause is part of the timeline rather than a client-side stop, so every
   viewer holds on the same frame at the same moment and the odds they are all
   looking at are the same odds. */
export const INTERMISSION_MS = Number(process.env.NEXT_PUBLIC_INTERMISSION_MS ?? 14_000);

export type Plan = {
  /** Milliseconds to wait *before* showing event i. */
  durations: number[];
  /** How much of durations[i] is a betting intermission rather than pacing.
      Non-zero only where playback deliberately holds. */
  pauseBefore: number[];
  totalMs: number;
  /** When betting closes: the moment the final meeting begins. */
  closesAtMs: number;
};

/** Total runtime is known up front, so the market countdown is exact rather
    than a guess. */
export function planPlayback(events: GameEvent[], speed = 1): Plan {
  const s = clampSpeed(speed);
  const durations = events.map((e) => DELAY[e.t] / s);
  const pauseBefore = events.map(() => 0);

  const finalMeeting = events.findLastIndex((e) => e.t === "MEETING_START");

  /* Hold after a vote resolves — but never after the last one, where the only
     thing left is the reveal and betting has already closed. */
  events.forEach((e, i) => {
    if (e.t !== "ELIMINATED" && e.t !== "NO_ELIMINATION") return;
    const next = i + 1;
    if (next >= events.length) return;
    if (finalMeeting !== -1 && next > finalMeeting) return;

    const hold = INTERMISSION_MS / s;
    pauseBefore[next] = hold;
    durations[next] += hold;
  });

  return {
    durations,
    pauseBefore,
    totalMs: durations.reduce((a, b) => a + b, 0),
    // Pauses are already inside durations, so this stays exact.
    closesAtMs: durations
      .slice(0, finalMeeting === -1 ? durations.length : finalMeeting)
      .reduce((a, b) => a + b, 0),
  };
}
