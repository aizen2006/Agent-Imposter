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
  marketId,
  onEnd,
  banner,
  endLabel = "Run another match",
}: {
  frames: Match[];
  durations: number[];
  marketId?: bigint;
  onEnd?: () => void;
  banner?: React.ReactNode;
  endLabel?: string;
}) {
  const [i, setI] = useState(-1);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let n = 0;

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
      timer.current = setTimeout(step, durations[n] ?? 0);
    };

    timer.current = setTimeout(step, durations[0] ?? 0);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // onEnd is intentionally not a dependency: it fires once and re-running
    // this effect would restart the match from the top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, durations]);

  const match = i >= 0 ? frames[i] : null;
  if (!match) return <Cueing />;

  return (
    <>
      {banner}
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
