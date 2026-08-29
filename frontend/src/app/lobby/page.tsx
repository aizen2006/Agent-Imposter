"use client";

import Link from "next/link";
import { Chrome, PageHead } from "@/components/Chrome";
import { StartMatch } from "@/components/StartMatch";
import { AGENTS } from "@/lib/match";
import { MARKET_ADDRESS } from "@/chain/monad";
import { ago, mon, useNow, useStats, type GameStat } from "@/lib/useStats";

/* The lobby (prd.md §15.5).

   This is the surface that makes the market mean anything. Before it existed
   every viewer generated a private match in their own tab, so the parimutuel
   pool had a population of one. Here everyone can see the same games and bet
   into the same pools. */

const ROSTER = Object.values(AGENTS);
const nameOf = (i: number | null) =>
  i === null ? "—" : (ROSTER.find((a) => a.index === i)?.id ?? "—");

export default function Lobby() {
  const { stats, loading } = useStats(10000);

  const now = useNow();
  /* Matches that have not started are the ones you can still comfortably bet
     on, so they come first — the whole point of the countdown (prd.md §16). */
  const opening = stats.games.filter((g) => !g.resolved && g.startedAt > now);
  const live = stats.games.filter((g) => !g.resolved && g.startedAt <= now);
  const settled = stats.games.filter((g) => g.resolved);

  return (
    <Chrome>
      <PageHead
        kicker="Lobby"
        title="Every match on the floor"
        note="Matches are shared, so anyone can watch one and bet into the same pool. Join a running game and it picks up wherever it has got to."
        right={
          <div className="mono" style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
            {stats.totals.players} {stats.totals.players === 1 ? "player" : "players"} ·{" "}
            {mon(stats.totals.staked)} MON staked
          </div>
        }
      />

      <div style={{ padding: "0 48px 44px", display: "grid", gap: 28 }}>
        <section>
          <Heading dot>Doors open — betting now</Heading>
          {opening.length === 0 ? (
            <Note>
              {loading
                ? "Looking for open markets…"
                : "No match is taking bets. Start one and everybody gets 90 seconds to back a suspect."}
            </Note>
          ) : (
            <Grid>
              {opening.map((g) => (
                <Card key={g.numericId} game={g} opening now={now} />
              ))}
            </Grid>
          )}
        </section>

        <section>
          <Heading dot>Playing now</Heading>
          {live.length === 0 ? (
            <Note>{loading ? "…" : "Nothing on the floor right now."}</Note>
          ) : (
            <Grid>
              {live.map((g) => (
                <Card key={g.numericId} game={g} live now={now} />
              ))}
            </Grid>
          )}
        </section>

        <section>
          <Heading>Start your own</Heading>
          <div
            style={{
              background: "var(--color-neutral-100)",
              borderRadius: "var(--radius-lg)",
              padding: "22px 22px 24px",
            }}
          >
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 14,
                color: "var(--color-neutral-700)",
                maxWidth: 520,
              }}
            >
              Generating a match opens a market on Monad testnet and publishes it here for
              everyone. Takes about twenty seconds.
            </p>
            <StartMatch />
          </div>
        </section>

        <section>
          <Heading>Recently settled</Heading>
          {settled.length === 0 ? (
            <Note>{loading ? "Reading the chain…" : "No games have settled yet."}</Note>
          ) : (
            <Grid>
              {settled.slice(0, 9).map((g) => (
                <Card key={g.numericId} game={g} now={now} />
              ))}
            </Grid>
          )}
        </section>

        <div
          className="mono"
          style={{ fontSize: 11, color: "var(--color-neutral-500)", paddingTop: 4 }}
        >
          All markets settle against {MARKET_ADDRESS} on Monad testnet.
        </div>
      </div>
    </Chrome>
  );
}

function Heading({ children, dot }: { children: React.ReactNode; dot?: boolean }) {
  return (
    <div
      className="kicker"
      style={{
        color: "var(--color-accent-700)",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {dot && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--color-accent)",
            animation: "pulseDot 1.6s ease-in-out infinite",
          }}
        />
      )}
      {children}
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
      gap: 14,
    }}
  >
    {children}
  </div>
);

function Card({
  game,
  live,
  opening,
  now,
}: {
  game: GameStat;
  live?: boolean;
  opening?: boolean;
  now: number;
}) {
  const top = game.pools.indexOf(Math.max(...game.pools));
  const crowdRight = game.totalPool > 0 && top === game.imposterId;
  const startsIn = Math.max(0, Math.ceil((game.startedAt - now) / 1000));

  return (
    <Link
      href={`/game/${game.id}`}
      className="room room-interactive"
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {opening ? (
          <span
            className="badge badge-accent"
            style={{ animation: "pulseDot 1.6s ease-in-out infinite" }}
          >
            BETTING OPEN
          </span>
        ) : live ? (
          <span className="badge badge-accent">LIVE</span>
        ) : game.abandoned ? (
          <span className="badge badge-ghost">REFUNDED</span>
        ) : (
          <span className={`badge ${crowdRight ? "badge-soft" : "badge-ghost"}`}>
            {game.totalPool > 0 ? (crowdRight ? "CROWD READ IT" : "CROWD FOOLED") : "SETTLED"}
          </span>
        )}
        <span className="mono" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
          {ago(game.startedAt)}
        </span>
      </div>

      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, marginTop: 10 }}>
        Match #{game.numericId.slice(-4)}
      </div>

      <div className="mono" style={{ fontSize: 12, marginTop: 4, color: "var(--color-neutral-700)" }}>
        {opening
          ? `starts in ${Math.floor(startsIn / 60)}:${String(startsIn % 60).padStart(2, "0")}`
          : game.resolved && !game.abandoned
            ? `${nameOf(game.imposterId)} was lying`
            : live
              ? "in progress — join it"
              : "settled"}
      </div>

      <div
        className="mono"
        style={{
          fontSize: 12,
          marginTop: 10,
          paddingTop: 9,
          borderTop: "1px solid var(--color-neutral-300)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{mon(game.totalPool)} MON</span>
        <span style={{ color: "var(--color-neutral-600)" }}>
          {game.bettors.length} {game.bettors.length === 1 ? "bettor" : "bettors"}
        </span>
      </div>
    </Link>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{ padding: "18px 0", fontSize: 13, color: "var(--color-neutral-600)" }}
    >
      {children}
    </div>
  );
}
