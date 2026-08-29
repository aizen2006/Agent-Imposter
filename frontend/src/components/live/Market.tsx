"use client";

import { CrewBlob } from "@/components/Crewmate";
import { agent, type AgentId, type Match } from "@/lib/match";

export function Market({
  match,
  selected,
  onSelect,
  mine = [],
}: {
  match: Match;
  selected: AgentId;
  onSelect: (id: AgentId) => void;
  /** Your stake on each agent, indexed 0–5. */
  mine?: number[];
}) {
  const myTotal = mine.reduce((a, b) => a + b, 0);
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 17 }}>
          Round {match.round} market — who&rsquo;s lying?
        </h4>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "var(--radius-pill)",
            background: "var(--color-accent)",
            color: "var(--color-bg)",
            fontSize: 10,
            letterSpacing: ".1em",
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
          }}
        >
          OPEN
        </span>
        <span
          className="mono"
          style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-neutral-600)" }}
        >
          pool {match.poolMon.toLocaleString()} MON
          {myTotal > 0 && (
            <>
              {" · "}
              <strong style={{ color: "var(--color-accent-700)" }}>
                you {myTotal.toFixed(2)}
              </strong>
            </>
          )}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {match.market.map((o) => {
          const a = agent(o.agent);
          const isSelected = selected === o.agent;
          const staked = mine[a.index] ?? 0;
          return (
            <div
              key={o.agent}
              className="market-row"
              style={
                staked > 0
                  ? { outline: "2px solid var(--color-accent)", outlineOffset: -2 }
                  : undefined
              }
              role="button"
              tabIndex={0}
              onClick={() => onSelect(o.agent)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(o.agent);
                }
              }}
            >
              {/* share of pool, drawn behind the row */}
              <div
                className="market-fill"
                style={{
                  width: `${o.share}%`,
                  background: o.leading
                    ? "var(--color-accent-200)"
                    : "var(--color-neutral-300)",
                }}
              />
              <CrewBlob hue={a.hue} h={29} w={26} />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15 }}>
                {a.id}
              </span>
              {/* Your position, called out on the row it belongs to. */}
              {staked > 0 && (
                <span
                  className="badge badge-accent"
                  style={{ flex: "none" }}
                  title="Your stake on this agent"
                >
                  YOU {staked.toFixed(2)}
                </span>
              )}
              <span
                className="market-note"
                style={{
                  color: o.leading
                    ? "var(--color-accent-800)"
                    : "var(--color-neutral-800)",
                }}
              >
                {o.note}
              </span>
              <span
                className="mono"
                style={{ marginLeft: "auto", fontSize: 13, color: "var(--color-neutral-700)" }}
              >
                {o.share}%
              </span>
              <span
                className="mono"
                style={{ fontSize: 17, width: 64, textAlign: "right" }}
              >
                {o.odds.toFixed(2)}×
              </span>
              <button
                type="button"
                className={`btn btn-pop ${o.leading ? "btn-primary" : "btn-outline"}`}
                style={{ padding: "6px 16px", fontSize: 12 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(o.agent);
                }}
              >
                {isSelected ? "Selected" : staked > 0 ? "Add" : "Bet"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
