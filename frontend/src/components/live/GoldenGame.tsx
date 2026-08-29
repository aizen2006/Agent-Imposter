"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Replay, Shell } from "./Replay";
import { project } from "@/engine/project";
import { planPlayback } from "@/engine/timing";
import type { GameEvent } from "@/engine/types";

/* The demo safety net (prd.md Stage 6).

   A pre-generated match replayed entirely in the browser. No API call, no
   model, no chain — if the venue wifi dies, this still runs off the filesystem.

   It projects through engine/project.ts, paces itself with engine/timing.ts and
   plays through the same <Replay> as the live match, so what you rehearse
   against is what the real thing looks like. The only deliberate difference is
   that betting is off: there is no on-chain market behind a recording, and a
   ticket that cannot settle should not be clickable. */

type Golden = { events: GameEvent[]; imposter: string; crewWon: boolean; brain: string };

export function GoldenGame({ speed = 1 }: { speed?: number }) {
  const [golden, setGolden] = useState<Golden | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/golden-game.json", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("404"))))
      .then((g: Golden) => !cancelled && setGolden(g))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const played = useMemo(() => {
    if (!golden) return null;
    const { durations, closesAtMs } = planPlayback(golden.events, speed);
    let elapsed = 0;
    const frames = golden.events.map((_, i) => {
      elapsed += durations[i];
      return project(golden.events, i + 1, {
        matchId: 1337,
        closesIn: Math.max(0, Math.round((closesAtMs - elapsed) / 1000)),
        spectators: 1204,
      });
    });
    return { frames, durations };
  }, [golden, speed]);

  if (missing) return <Missing />;
  if (!played) return null;

  return (
    <Replay
      frames={played.frames}
      durations={played.durations}
      banner={<Banner />}
      endLabel="Run a live match"
    />
  );
}

const Banner = () => (
  <div
    className="mono"
    style={{
      maxWidth: 1320,
      margin: "0 auto",
      padding: "18px 24px 0",
      width: "100%",
      fontSize: 12,
      color: "var(--color-neutral-600)",
    }}
  >
    <span className="badge">RECORDED MATCH</span>{" "}
    <span style={{ marginLeft: 6 }}>replaying from disk · betting disabled · no network</span>
  </div>
);

const Missing = () => (
  <Shell>
    <h3 style={{ margin: 0 }}>No golden game has been baked yet.</h3>
    <p className="mono" style={{ color: "var(--color-neutral-700)", marginTop: 10, fontSize: 13 }}>
      bun --env-file=.env.local src/engine/golden.ts 12 --llm
    </p>
    <Link href="/" className="btn btn-primary" style={{ marginTop: 16, padding: "12px 24px" }}>
      Run a live match instead
    </Link>
  </Shell>
);
