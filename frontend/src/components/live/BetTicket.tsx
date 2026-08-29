"use client";

import { useEffect, useState } from "react";
import { Crewmate } from "@/components/Crewmate";
import { explorerTx } from "@/chain/monad";
import { useGameState, useMarketWrite, usePayout, useWallet } from "@/chain/useMarket";
import { AGENTS, agent, formatClock, type AgentId, type Match } from "@/lib/match";

/** Contract agent index -> name. The index order is fixed (ATLAS 0 … FLINT 5)
    and is what bet() takes, so this is a lookup, not a mapping to maintain. */
const AGENT_BY_INDEX: Record<number, string> = Object.fromEntries(
  Object.values(AGENTS).map((a) => [a.index, a.id]),
);

const QUICK = [0.05, 0.1, 0.5];

export function BetTicket({
  match,
  selected,
  marketId,
  mine = [],
  myTotal = 0,
}: {
  match: Match;
  selected: AgentId;
  marketId?: bigint;
  /** Your stake on each agent, indexed 0–5. */
  mine?: number[];
  myTotal?: number;
}) {
  const [stake, setStake] = useState(0.1);
  const wallet = useWallet();
  const write = useMarketWrite();
  const game = useGameState(marketId);
  const { payout, refetch: refetchPayout } = usePayout(marketId, wallet.address);

  const a = agent(selected);
  const onThis = mine[a.index] ?? 0;
  const outcome = match.market.find((m) => m.agent === selected);
  const odds = outcome?.odds ?? 1;
  const potential = stake * odds;

  const resolved = game?.resolved ?? false;
  const closed = resolved || match.closesIn <= 0;

  useEffect(() => {
    if (write.isConfirmed) refetchPayout();
  }, [write.isConfirmed, refetchPayout]);

  const disabled =
    !wallet.isConnected || wallet.wrongChain || !marketId || write.isPending || write.isConfirming;

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
        {/* Your position across the whole match, so the ticket is never the
            only thing on screen and your own money is invisible. */}
        {myTotal > 0 && (
          <div
            className="mono"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 12,
              paddingBottom: 10,
              borderBottom: "1px solid var(--color-neutral-300)",
              fontSize: 12,
              color: "var(--color-neutral-700)",
            }}
          >
            <span>your position</span>
            <span>
              {mine
                .map((v, i) => ({ v, i }))
                .filter((x) => x.v > 0)
                .map((x) => `${AGENT_BY_INDEX[x.i] ?? `#${x.i}`} ${x.v.toFixed(2)}`)
                .join(" · ")}
            </span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Crewmate hue={a.hue} h={34} motion="bob" duration={3} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>
              {resolved ? "Market settled" : `${a.id} is the Imposter`}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>
              R{match.round} · {odds.toFixed(2)}×
              {onThis > 0 ? ` · you hold ${onThis.toFixed(2)}` : ""} ·{" "}
              {resolved
                ? "claim below"
                : match.closesIn > 0
                  ? `locks in ${formatClock(match.closesIn)}`
                  : "closed"}
            </div>
          </div>
        </div>

        {/* Settled: the only thing left to do is take the money. */}
        {resolved ? (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "12px 0",
                borderTop: "2px dashed var(--color-neutral-300)",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                {payout > 0 ? "You're owed" : "Nothing to claim"}
              </span>
              <span className="mono" style={{ fontSize: 26 }}>
                {payout.toFixed(4)} MON
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lock"
              disabled={payout <= 0 || disabled}
              onClick={() => marketId && write.claim(marketId)}
            >
              {write.isConfirming ? "Claiming…" : "Claim"}
              <span className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
                {game?.abandoned ? "refund" : "winnings"}
              </span>
            </button>
          </>
        ) : (
          <>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 14,
                background: "var(--color-bg)",
                padding: "10px 14px",
                border: "2px solid transparent",
              }}
            >
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
              <span className="mono" style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
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
                {potential.toFixed(3)} MON
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lock"
              disabled={disabled || closed || stake <= 0}
              onClick={() => marketId && write.bet(marketId, a.index, stake)}
            >
              {ctaLabel(wallet, write, closed, marketId)}
              <span className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
                {a.id}
              </span>
            </button>

            <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 8 }}>
              No takebacks, no crying. Settles onchain the second the vote lands.
            </div>
          </>
        )}
      </div>

      {/* Transaction state — the design's toast, driven by the real receipt. */}
      {(write.hash || write.error) && (
        <div
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
              animation: write.isConfirming ? "pulseDot 1.2s linear infinite" : undefined,
              flex: "none",
            }}
          />
          <div style={{ flex: 1, fontSize: 12 }}>
            <strong style={{ fontFamily: "var(--font-heading)" }}>
              {write.error
                ? "Transaction rejected"
                : write.isConfirmed
                  ? "Confirmed"
                  : "Confirming…"}
            </strong>
            <div className="mono" style={{ fontSize: 10, opacity: 0.7 }}>
              {write.error
                ? shortError(write.error)
                : `${write.hash?.slice(0, 6)}…${write.hash?.slice(-4)}`}
            </div>
          </div>
          {write.hash && (
            <a
              href={explorerTx(write.hash)}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: "var(--radius-pill)",
                background: "color-mix(in srgb, #f3f2f2 18%, transparent)",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              View
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ctaLabel(
  wallet: ReturnType<typeof useWallet>,
  write: ReturnType<typeof useMarketWrite>,
  closed: boolean,
  marketId?: bigint,
) {
  if (!wallet.isConnected) return "Connect a wallet first";
  if (wallet.wrongChain) return "Switch to Monad testnet";
  if (!marketId) return "Market not open";
  if (closed) return "Betting closed";
  if (write.isPending) return "Check your wallet…";
  if (write.isConfirming) return "Confirming…";
  return "Lock it in";
}

/** viem errors are paragraphs; the first line is the useful part. */
function shortError(err: Error) {
  const first = err.message.split("\n")[0];
  if (/user rejected/i.test(first)) return "you rejected it";
  return first.slice(0, 60);
}
