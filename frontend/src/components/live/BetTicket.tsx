"use client";

import { useState } from "react";
import { Crewmate } from "@/components/Crewmate";
import { agent, formatClock, type AgentId, type Match } from "@/lib/match";

const QUICK = [10, 25, 100];

export function BetTicket({
  match,
  selected,
}: {
  match: Match;
  selected: AgentId;
}) {
  const [stake, setStake] = useState(25);
  const [toast, setToast] = useState<{ amount: number; tx: string } | null>({
    amount: 25,
    tx: "0x4c1…9ab",
  });

  const a = agent(selected);
  const outcome = match.market.find((m) => m.agent === selected);
  const odds = outcome?.odds ?? 1;
  const payout = stake * odds;

  return (
    <div style={{ marginTop: "auto", padding: "18px 20px 20px" }}>
      <div
        style={{
          borderRadius: "var(--radius-xl)",
          background: "var(--color-surface)",
          boxShadow: "var(--shadow-ticket)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Crewmate hue={a.hue} h={34} motion="bob" duration={3} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>
              {a.id} is the Imposter
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--color-neutral-700)" }}
            >
              R{match.round} · {odds.toFixed(2)}× · locks in {formatClock(match.closesIn)}
            </div>
          </div>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 14,
            background: "var(--color-bg)",
            padding: "10px 14px",
            border: "2px solid transparent",
            transition: "border-color var(--dur-fast) var(--ease)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
        >
          <span className="sr-only" style={{ position: "absolute", left: -9999 }}>
            Stake in MON
          </span>
          <input
            className="input mono"
            inputMode="decimal"
            value={stake}
            onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
            style={{
              border: 0,
              background: "transparent",
              padding: 0,
              minHeight: 0,
              fontSize: 22,
              width: "100%",
            }}
          />
          <span
            className="mono"
            style={{ fontSize: 12, color: "var(--color-neutral-600)" }}
          >
            MON
          </span>
        </label>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {QUICK.map((v) => (
            <button
              key={v}
              type="button"
              className={`chip ${stake === v ? "chip-active" : ""}`}
              style={{ border: 0 }}
              onClick={() => setStake(v)}
            >
              {v}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            style={{
              marginLeft: "auto",
              background: "transparent",
              color: "var(--color-accent-700)",
              padding: "5px 12px",
              border: 0,
            }}
            onClick={() => setStake(412)}
          >
            Max
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 14,
            paddingTop: 12,
            borderTop: "2px dashed var(--color-neutral-300)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            If you&rsquo;re right
          </span>
          <span className="mono" style={{ fontSize: 26 }}>
            {payout.toFixed(2)} MON
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lock"
          style={{ marginTop: 12 }}
          onClick={() => setToast({ amount: stake, tx: "0x4c1…9ab" })}
        >
          Lock it in
          <span className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
            gas ~0.0004
          </span>
        </button>

        <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 8 }}>
          No takebacks, no crying. Settles onchain the second the vote lands.
        </div>
      </div>

      {toast && (
        <div
          key={`${toast.amount}-${toast.tx}`}
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "11px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-text)",
            color: "var(--color-bg)",
            boxShadow: "var(--shadow-toast)",
            animation: "toastIn 320ms var(--ease)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--color-accent)",
              animation: "pulseDot 1.2s linear infinite",
              flex: "none",
            }}
          />
          <div style={{ flex: 1, fontSize: 12 }}>
            <strong style={{ fontFamily: "var(--font-heading)" }}>
              Confirming your bet…
            </strong>
            <div className="mono" style={{ fontSize: 10, opacity: 0.7 }}>
              {toast.amount} MON · {toast.tx}
            </div>
          </div>
          <button
            type="button"
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: "var(--radius-pill)",
              background: "color-mix(in srgb, #f3f2f2 18%, transparent)",
              color: "inherit",
              border: 0,
              cursor: "pointer",
            }}
          >
            View
          </button>
        </div>
      )}
    </div>
  );
}
