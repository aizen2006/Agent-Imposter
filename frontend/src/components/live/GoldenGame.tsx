"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LiveMatch } from "./LiveMatch";
import { project } from "@/engine/project";
import { planPlayback } from "@/engine/timing";
import type { GameEvent } from "@/engine/types";
import type { Match } from "@/lib/match";

/* The demo safety net (prd.md Stage 6).

   A pre-generated match replayed entirely in the browser. No API call, no
   SSE, no model, no chain — if the venue wifi dies or OpenAI has a bad
   afternoon, this still runs off the filesystem.

   It projects through engine/project.ts and paces itself with engine/timing.ts,
   the same two modules the live path uses, so what you rehearse against is
   what the real thing looks like. The only deliberate difference is that
   betting is off: there is no on-chain market behind a recording, and a
   ticket that cannot settle should not be clickable. */

type Golden = {
  events: GameEvent[];
  imposter: string;
  crewWon: boolean;
  brain: string;
  meta?: { durationMs: number };
};

export function GoldenGame({ speed = 1 }: { speed?: number }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [done, setDone] = useState(false);
  const [missing, setMissing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch("/golden-game.json", { cache: "force-cache" });
      if (!res.ok) {
        setMissing(true);
        return;
      }
      const golden = (await res.json()) as Golden;
      if (cancelled) return;

      const { events } = golden;
      const { durations, closesAtMs } = planPlayback(events, speed);
      let elapsed = 0;
      let i = 0;

      // A recursive timeout rather than an interval: each event has its own
      // beat, and drifting off a fixed tick would flatten the pacing.
      const step = () => {
        if (cancelled || i >= events.length) {
          if (!cancelled) setDone(true);
          return;
        }
        elapsed += durations[i];
        setMatch(
          project(events, i + 1, {
            matchId: 1337,
            closesIn: Math.max(0, Math.round((closesAtMs - elapsed) / 1000)),
            spectators: 1204,
          }),
        );
        i++;
        timer.current = setTimeout(step, durations[i] ?? 0);
      };

      timer.current = setTimeout(step, durations[0] ?? 0);
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [speed]);

  if (missing) return <Missing />;
  if (!match) return <Loading />;

  return (
    <>
      <Banner />
      {/* No marketId — betting is disabled, which is correct for a recording. */}
      <LiveMatch match={match} />
      {done && (
        <div style={{ textAlign: "center", paddingBottom: 48 }}>
          <Link href="/" className="btn btn-primary" style={{ padding: "12px 28px" }}>
            Run a live match
          </Link>
        </div>
      )}
    </>
  );
}

function Banner() {
  return (
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
      <span style={{ marginLeft: 6 }}>
        replaying from disk · betting disabled · no network
      </span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 24px 64px", width: "100%" }}>
      <div
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-shell)",
          boxShadow: "var(--shadow-shell)",
          padding: "80px 48px",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const Loading = () => (
  <Shell>
    <h3 style={{ margin: 0 }}>Cueing up the recording…</h3>
  </Shell>
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
