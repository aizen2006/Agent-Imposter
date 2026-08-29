"use client";

import { TopBar } from "@/components/live/TopBar";

/* The shell every page outside a running match sits in.

   The match page builds its own because the bar has to sit inside the same
   rounded surface as the map and the ticket. Everything else gets it from
   here, so the wallet and the nav are in one place on every screen. */

export function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 24px 64px", width: "100%" }}>
      <div
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-shell)",
          boxShadow: "var(--shadow-shell)",
          overflow: "hidden",
        }}
      >
        <TopBar />
        {children}
      </div>
    </div>
  );
}

/** Page heading used by lobby, leaderboard and my-bets. */
export function PageHead({
  kicker,
  title,
  note,
  right,
}: {
  kicker: string;
  title: string;
  note?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "36px 48px 26px",
        display: "flex",
        gap: 20,
        alignItems: "flex-end",
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div className="kicker" style={{ color: "var(--color-accent-700)" }}>
          {kicker}
        </div>
        <h1 style={{ margin: "8px 0 0", fontSize: 34 }}>{title}</h1>
        {note && (
          <p
            style={{
              margin: "8px 0 0",
              maxWidth: 620,
              fontSize: 14,
              color: "var(--color-neutral-700)",
            }}
          >
            {note}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}
