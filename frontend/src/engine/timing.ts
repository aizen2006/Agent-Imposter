import type { GameEvent } from "./types";

/* Playback timing (prd.md §7.1).

   Shared by the live SSE route and the golden-game fallback. It lives here
   rather than in the route because the fallback exists to look identical to
   the real thing — if the two tables drifted, the safety net would replay at
   a different rhythm than everything you rehearsed. */

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

export type Plan = {
  /** Milliseconds to wait *before* showing event i. */
  durations: number[];
  totalMs: number;
  /** When betting closes: the moment the final meeting begins. */
  closesAtMs: number;
};

/** Total runtime is known up front, so the market countdown is exact rather
    than a guess. */
export function planPlayback(events: GameEvent[], speed = 1): Plan {
  const s = clampSpeed(speed);
  const durations = events.map((e) => DELAY[e.t] / s);
  const finalMeeting = events.findLastIndex((e) => e.t === "MEETING_START");

  return {
    durations,
    totalMs: durations.reduce((a, b) => a + b, 0),
    closesAtMs: durations
      .slice(0, finalMeeting === -1 ? durations.length : finalMeeting)
      .reduce((a, b) => a + b, 0),
  };
}
