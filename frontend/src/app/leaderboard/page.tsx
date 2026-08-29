"use client";

import { Chrome, PageHead } from "@/components/Chrome";
import { useWallet } from "@/chain/useMarket";
import { mon, short, useStats, type LeaderRow } from "@/lib/useStats";

/* Leaderboard (prd.md §15.4).

   Ranked on net P&L, but hit rate sits right beside it — one lucky bet on a
   long shot outranks a careful player on money alone, and showing both stops
   the table telling a lie by omission.

   Every figure is recomputed from contract view calls. The match store only
   supplies the list of games and where to look for their bets. */

export default function Leaderboard() {
  const { stats, loading } = useStats();
  const wallet = useWallet();
  const me = wallet.address?.toLowerCase();

  const rows = stats.leaders;
  const mine = rows.find((r) => r.address.toLowerCase() === me);
  const inTop = mine ? rows.slice(0, 20).some((r) => r.address.toLowerCase() === me) : false;

  return (
    <Chrome>
      <PageHead
        kicker="Leaderboard"
        title="Who reads the room"
        note="Net profit and loss across every settled market, straight from the contract. Hit rate is shown beside it because one lucky long shot is not skill."
      />

      <div style={{ padding: "0 48px 44px" }}>
        {rows.length === 0 ? (
          <div
            className="mono"
            style={{ padding: "40px 0", fontSize: 13, color: "var(--color-neutral-600)" }}
          >
            {loading
              ? "Reading the chain…"
              : "Nobody has placed a bet yet. Be the first and this table is yours."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 2, background: "var(--color-divider)" }}>
            <Head />
            {rows.slice(0, 20).map((r, i) => (
              <Row key={r.address} rank={i + 1} row={r} you={r.address.toLowerCase() === me} />
            ))}
            {/* Pin your own row when you did not make the cut. */}
            {mine && !inTop && (
              <>
                <div
                  className="mono"
                  style={{
                    background: "var(--color-bg)",
                    padding: "6px 16px",
                    fontSize: 11,
                    color: "var(--color-neutral-500)",
                  }}
                >
                  ···
                </div>
                <Row rank={rows.indexOf(mine) + 1} row={mine} you />
              </>
            )}
          </div>
        )}
      </div>
    </Chrome>
  );
}

const COLS = "44px 1fr repeat(4, minmax(70px, 96px))";

function Head() {
  return (
    <div
      className="mono"
      style={{
        background: "var(--color-surface)",
        display: "grid",
        gridTemplateColumns: COLS,
        gap: 12,
        padding: "10px 16px",
        fontSize: 11,
        letterSpacing: ".04em",
        color: "var(--color-neutral-600)",
        textTransform: "uppercase",
      }}
    >
      <span>#</span>
      <span>Player</span>
      <span style={{ textAlign: "right" }}>Staked</span>
      <span style={{ textAlign: "right" }}>Returned</span>
      <span style={{ textAlign: "right" }}>Hit rate</span>
      <span style={{ textAlign: "right" }}>Net</span>
    </div>
  );
}

function Row({ rank, row, you }: { rank: number; row: LeaderRow; you?: boolean }) {
  const up = row.net > 0;
  const flat = row.net === 0;

  return (
    <div
      style={{
        background: you ? "var(--color-accent-100)" : "var(--color-bg)",
        display: "grid",
        gridTemplateColumns: COLS,
        gap: 12,
        padding: "13px 16px",
        alignItems: "center",
      }}
    >
      <span className="mono" style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
        {rank}
      </span>
      <span className="mono" style={{ fontSize: 13 }}>
        {short(row.address)}
        {you && (
          <span className="badge badge-soft" style={{ marginLeft: 8 }}>
            YOU
          </span>
        )}
      </span>
      <span className="mono" style={{ fontSize: 13, textAlign: "right" }}>
        {mon(row.staked)}
      </span>
      <span className="mono" style={{ fontSize: 13, textAlign: "right" }}>
        {mon(row.returned)}
      </span>
      <span
        className="mono"
        style={{ fontSize: 13, textAlign: "right", color: "var(--color-neutral-700)" }}
        title={`${row.hits} of ${row.games}`}
      >
        {row.hitRate}%
      </span>
      <span
        className="mono"
        style={{
          fontSize: 13,
          textAlign: "right",
          fontWeight: 700,
          // Accent is reserved (design.md §9); losses are muted, not red.
          color: flat
            ? "var(--color-neutral-600)"
            : up
              ? "var(--color-text)"
              : "var(--color-neutral-500)",
        }}
      >
        {up ? "+" : ""}
        {mon(row.net)}
      </span>
    </div>
  );
}
