"use client";

import { useEffect, useState } from "react";
import { formatClock, type Match } from "@/lib/match";

export function MatchBar({ match }: { match: Match }) {
  const [left, setLeft] = useState(match.closesIn);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "18px 22px",
        background: "linear-gradient(180deg,var(--color-neutral-200),var(--color-bg))",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 12px",
          borderRadius: "var(--radius-pill)",
          background: "var(--color-accent)",
          color: "var(--color-bg)",
          fontSize: 10,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          animation: "ringOut 2s var(--ease) infinite",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--color-bg)",
            animation: "pulseDot 1.2s linear infinite",
          }}
        />
        Live
      </span>

      <div>
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: 24,
            lineHeight: 1.1,
          }}
        >
          Match {match.id} — “{match.title}”
        </div>
        {/* `spectators` used to be invented from the game seed, which is a
            fabricated number on a screen where everything else is read back
            from the contract. The pool is the real measure of a crowd. */}
        <div style={{ fontSize: 12, color: "var(--color-neutral-700)", marginTop: 2 }}>
          Round {match.round} of {match.totalRounds} · {match.aliveCount} agents still
          employed · {match.poolMon > 0
            ? `${match.poolMon.toFixed(2)} MON in the pool`
            : "no bets yet"}
        </div>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--color-accent-700)",
            }}
          >
            {left > 0 ? "Market closes in" : "Market closed"}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 30,
              lineHeight: 1,
              animation: left > 0 ? "pulseDot 1s steps(2,end) infinite" : undefined,
            }}
          >
            {formatClock(Math.max(0, left))}
          </div>
        </div>
        <button type="button" className="btn btn-chrome">
          Mute crew
        </button>
      </div>
    </div>
  );
}
