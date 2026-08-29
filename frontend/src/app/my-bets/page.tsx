"use client";

import Link from "next/link";
import { Chrome, PageHead } from "@/components/Chrome";
import { useMarketWrite, useWallet } from "@/chain/useMarket";
import { AGENTS } from "@/lib/match";
import { ago, mon, useStats, type GameStat } from "@/lib/useStats";

/* My bets (prd.md §15.4).

   The same aggregate as the leaderboard, filtered to the connected wallet.
   Its real job is unclaimed winnings: a parimutuel payout sits in the contract
   until someone asks for it, and nothing else in the app tells you that you
   are owed money. */

const ROSTER = Object.values(AGENTS);
const nameOf = (i: number | null) =>
  i === null ? "—" : (ROSTER.find((a) => a.index === i)?.id ?? "—");

export default function MyBets() {
  const wallet = useWallet();
  const { stats, loading } = useStats();
  const write = useMarketWrite();
  const me = wallet.address?.toLowerCase();

  const mine = me
    ? stats.games
        .map((g) => ({ game: g, bet: g.bettors.find((b) => b.address.toLowerCase() === me) }))
        .filter((x): x is { game: GameStat; bet: NonNullable<typeof x.bet> } => Boolean(x.bet))
    : [];

  const owed = mine.filter((x) => x.game.resolved && x.bet.payout > 0);
  const total = owed.reduce((a, x) => a + x.bet.payout, 0);

  return (
    <Chrome>
      <PageHead
        kicker="My bets"
        title="Your positions"
        note="Every market you have staked into, and anything the contract still owes you."
      />

      <div style={{ padding: "0 48px 44px" }}>
        {!wallet.isConnected ? (
          <Note>
            Connect a wallet to see your positions.{" "}
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 14, padding: "10px 20px" }}
              onClick={() => wallet.connect()}
            >
              Connect wallet
            </button>
          </Note>
        ) : mine.length === 0 ? (
          <Note>
            {loading ? "Reading the chain…" : "You have not backed anyone yet."}{" "}
            <Link href="/lobby" className="mono" style={{ display: "block", marginTop: 10 }}>
              find a live market →
            </Link>
          </Note>
        ) : (
          <>
            {total > 0 && (
              <div
                style={{
                  background: "var(--color-accent-100)",
                  borderRadius: "var(--radius-lg)",
                  padding: "18px 20px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20 }}>
                    {mon(total)} MON waiting
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                    across {owed.length} settled {owed.length === 1 ? "market" : "markets"} —
                    claim each below
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gap: 2, background: "var(--color-divider)" }}>
              {mine.map(({ game, bet }) => {
                const picked = game.pools
                  .map((v, i) => ({ v, i }))
                  .filter((x) => x.v > 0);
                const claimable = game.resolved && bet.payout > 0;

                return (
                  <div
                    key={game.numericId}
                    style={{
                      background: "var(--color-bg)",
                      padding: "14px 16px",
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto",
                      gap: 16,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <Link
                        href={`/game/${game.id}`}
                        style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}
                      >
                        Match #{game.numericId.slice(-4)}
                      </Link>
                      <div
                        className="mono"
                        style={{ fontSize: 12, color: "var(--color-neutral-600)" }}
                      >
                        {game.resolved
                          ? `${nameOf(game.imposterId)} was the Imposter`
                          : "still running"}{" "}
                        · {ago(game.startedAt)} · {picked.length} agents backed
                      </div>
                    </div>

                    <span className="mono" style={{ fontSize: 13 }}>
                      {mon(bet.staked)} staked
                    </span>

                    <span
                      className="mono"
                      style={{
                        fontSize: 13,
                        color: bet.onWinner > 0 ? "var(--color-text)" : "var(--color-neutral-500)",
                      }}
                    >
                      {game.resolved
                        ? bet.onWinner > 0
                          ? `${mon(bet.payout)} won`
                          : "lost"
                        : "—"}
                    </span>

                    {claimable ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: "8px 16px", fontSize: 13 }}
                        disabled={write.isPending || write.isConfirming}
                        onClick={() => write.claim(BigInt(game.numericId))}
                      >
                        {write.isPending || write.isConfirming ? "Claiming…" : "Claim"}
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Chrome>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{ padding: "34px 0", fontSize: 13, color: "var(--color-neutral-600)" }}
    >
      {children}
    </div>
  );
}
