"use client";

import { useEffect, useState } from "react";
import { LiveMatch } from "./LiveMatch";
import type { Match } from "@/lib/match";

/* The doors-open period before a match begins.

   This is where most betting will actually happen, and it is the whole reason
   the market has more than one participant: everybody can see the same game
   coming and stake before it starts. The board underneath is the real first
   frame — the crew in their opening positions — so what you are betting on is
   in front of you, with nothing given away.

   The countdown is derived from wall clock, not counted down locally, so a
   viewer who arrives late or whose tab was backgrounded still sees the truth. */

export function PreMatch({
  match,
  marketId,
  startAt,
  onStart,
  shared = true,
}: {
  match: Match;
  marketId?: bigint;
  startAt: number;
  onStart: () => void;
  /** False when the match was never published — inviting someone to a link
      that 404s is worse than not offering. */
  shared?: boolean;
}) {
  const [left, setLeft] = useState(() => Math.max(0, startAt - Date.now()));

  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, startAt - Date.now());
      setLeft(ms);
      if (ms === 0) onStart();
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [startAt, onStart]);

  const secs = Math.ceil(left / 1000);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");
  const closing = secs <= 15;

  return (
    <>
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "18px 24px 0",
          width: "100%",
        }}
      >
        <div
          style={{
            background: closing ? "var(--color-accent-100)" : "var(--color-neutral-100)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <span
            className="badge badge-accent"
            style={{ animation: "pulseDot 1.6s ease-in-out infinite" }}
          >
            BETTING OPEN
          </span>

          <div>
            <div
              className="mono"
              style={{
                fontSize: 28,
                fontWeight: 700,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {mm}:{ss}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
              until the match begins
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "var(--color-neutral-700)",
              maxWidth: 460,
            }}
          >
            Everyone watching starts at the same moment. Pick who you think is lying and
            stake below — betting stays open into the first round, then closes when they
            sit down to vote.
          </p>

          {shared ? <ShareLink /> : <PrivateNote />}
        </div>
      </div>

      {/* The opening board, so the bet is placed against something real. */}
      <LiveMatch match={match} marketId={marketId} />
    </>
  );
}

const PrivateNote = () => (
  <span
    className="mono"
    style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-neutral-600)" }}
    title="Set BLOB_READ_WRITE_TOKEN to let other people join"
  >
    private match — sharing not configured
  </span>
);

/** Getting a second person into the same market is the entire point, so the
    link to do it should not require selecting the address bar. */
function ShareLink() {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-outline"
      style={{ marginLeft: "auto", padding: "10px 18px", fontSize: 13 }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Link copied" : "Invite someone"}
    </button>
  );
}
