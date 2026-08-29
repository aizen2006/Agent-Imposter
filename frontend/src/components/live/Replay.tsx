"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LiveMatch } from "./LiveMatch";
import type { Match } from "@/lib/match";

/* Plays a finished match back on a timer.

   One player for both paths — the live match and the recorded fallback —
   because a safety net that runs different code from the thing it stands in
   for is not a safety net. The live path feeds it frames projected on the
   server; the golden path projects them in the browser. From here they are
   identical. */

export function Replay({
  frames,
  durations,
  pauseBefore,
  marketId,
  onEnd,
  banner,
  startAtMs = 0,
  endLabel = "Run another match",
}: {
  frames: Match[];
  durations: number[];
  /** How much of durations[i] is a held betting window (engine/timing.ts). */
  pauseBefore?: number[];
  marketId?: bigint;
  onEnd?: () => void;
  banner?: React.ReactNode;
  /** Milliseconds already elapsed — a viewer joining a match in progress
      starts where it actually is rather than replaying it from the top. */
  startAtMs?: number;
  endLabel?: string;
}) {
  const [i, setI] = useState(-1);
  const [done, setDone] = useState(false);
  /** Epoch ms at which the current intermission ends, or 0 when playing. */
  const [holdUntil, setHoldUntil] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Walk the timeline to find where a late joiner should come in.
    let n = 0;
    if (startAtMs > 0) {
      let t = 0;
      while (n < durations.length && t + durations[n] <= startAtMs) {
        t += durations[n];
        n += 1;
      }
    }

    // A chained timeout rather than an interval: every event has its own beat
    // and a fixed tick would flatten the pacing (prd.md §7.1).
    const step = () => {
      if (cancelled) return;
      if (n >= frames.length) {
        setDone(true);
        if (!ended.current) {
          ended.current = true;
          onEnd?.();
        }
        return;
      }
      setI(n);
      n += 1;

      /* An intermission is the tail of the next frame's delay. Announce it so
         the screen says "betting window" rather than appearing to freeze. */
      const hold = pauseBefore?.[n] ?? 0;
      setHoldUntil(hold > 0 ? Date.now() + (durations[n] ?? 0) : 0);

      timer.current = setTimeout(step, durations[n] ?? 0);
    };

    // A joiner mid-match shows their frame immediately; the first tick then
    // carries them to the next one.
    timer.current = setTimeout(step, n === 0 ? (durations[0] ?? 0) : 0);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // onEnd is intentionally not a dependency: it fires once and re-running
    // this effect would restart the match from the top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, durations, startAtMs]);

  const match = i >= 0 ? frames[i] : null;
  if (!match) return <Cueing />;

  return (
    <>
      {banner}
      {holdUntil > 0 && !done && (
        <Intermission until={holdUntil} betting={Boolean(marketId)} />
      )}
      <LiveMatch match={match} marketId={marketId} />
      {done && (
        <div style={{ textAlign: "center", paddingBottom: 48 }}>
          <Link href="/" className="btn btn-primary" style={{ padding: "12px 28px" }}>
            {endLabel}
          </Link>
        </div>
      )}
    </>
  );
}

/* The held beat between rounds. The market is live underneath it — this is
   the moment the pause exists to create, so it says so plainly. */
function Intermission({ until, betting }: { until: number; betting: boolean }) {
  const [left, setLeft] = useState(() => Math.max(0, until - Date.now()));

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, until - Date.now())), 200);
    return () => clearInterval(t);
  }, [until]);

  if (left <= 0) return null;

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "18px 24px 0", width: "100%" }}>
      <div
        style={{
          background: "var(--color-accent-100)",
          borderRadius: "var(--radius-lg)",
          padding: "13px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          className="badge badge-accent"
          style={{ animation: "pulseDot 1.6s ease-in-out infinite" }}
        >
          {betting ? "BETTING WINDOW" : "ROUND BREAK"}
        </span>
        <span
          className="mono"
          style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
        >
          {Math.ceil(left / 1000)}s
        </span>
        <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>
          {betting
            ? "The vote just landed. Change your mind, or back it harder — the next round starts when this runs out."
            : "The vote just landed. In a live match this is when you would move your money."}
        </span>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
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

function Cueing() {
  return (
    <Shell>
      <div style={{ display: "inline-flex", gap: 6, marginBottom: 14 }}>
        {[0, 0.2, 0.4].map((d) => (
          <span
            key={d}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "var(--color-accent)",
              animation: "pulseDot 1s ease-in-out infinite",
              animationDelay: `${d}s`,
            }}
          />
        ))}
      </div>
      <h3 style={{ margin: 0 }}>Everyone is getting into position.</h3>
    </Shell>
  );
}
