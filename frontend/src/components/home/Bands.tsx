"use client";

import Link from "next/link";
import { Crewmate } from "@/components/Crewmate";
import { AGENTS, type AgentId } from "@/lib/match";
import { MARKET_ADDRESS, explorerTx } from "@/chain/monad";
import { ago, mon, useNow, useStats, type GameStat } from "@/lib/useStats";

/* Home page bands (prd.md §15.3).

   Every number here is read back from the contract. Nothing is decorative or
   invented — a stranger cannot tell whether any of this is real, and the only
   convincing answer is settled games with transaction links. Where there is no
   data yet, each band says so rather than showing a plausible zero. */

const ROSTER = Object.values(AGENTS) as { id: AgentId; index: number; hue: number; tag: string; trait: string }[];
const nameOf = (i: number | null) => (i === null ? "—" : (ROSTER.find((a) => a.index === i)?.id ?? "—"));

export function Band({
  children,
  tone = "bg",
}: {
  children: React.ReactNode;
  tone?: "bg" | "surface" | "ink";
}) {
  const bg =
    tone === "ink" ? "var(--color-text)" : tone === "surface" ? "var(--color-surface)" : "var(--color-bg)";
  return (
    <section
      style={{
        background: bg,
        color: tone === "ink" ? "var(--color-bg)" : "var(--color-text)",
        padding: "44px 48px",
      }}
    >
      {children}
    </section>
  );
}

export const Rule = () => <div style={{ height: 2, background: "var(--color-divider)" }} />;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="kicker" style={{ color: "var(--color-accent-700)", marginBottom: 14 }}>
      {children}
    </div>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────── */

export function Hero() {
  const { stats } = useStats();
  const { openMarkets, staked, resolved } = stats.totals;

  return (
    <Band>
      <Eyebrow>Agent Imposter · Monad testnet</Eyebrow>
      <h1 style={{ maxWidth: 780, margin: 0, lineHeight: 1.02 }}>
        Six AI agents. One is lying. You bet on which.
      </h1>
      <p
        style={{
          maxWidth: 560,
          marginTop: 16,
          fontSize: 17,
          color: "var(--color-neutral-700)",
        }}
      >
        They move, work, sabotage and accuse each other on their own. You watch, read
        the room, and stake MON on the traitor before the final vote.
      </p>

      {/* Live counters, not decoration — straight off the contract. */}
      <div
        className="mono"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          marginTop: 22,
          fontSize: 13,
          color: "var(--color-neutral-700)",
        }}
      >
        <Stat label="markets open" value={String(openMarkets)} live={openMarkets > 0} />
        <Stat label="MON staked" value={mon(staked)} />
        <Stat label="games settled" value={String(resolved)} />
      </div>
    </Band>
  );
}

function Stat({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      {live && (
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
      <strong style={{ fontSize: 15, color: "var(--color-text)" }}>{value}</strong>
      {label}
    </span>
  );
}

/* ── How it works ──────────────────────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    h: "Watch",
    p: "A match is generated end to end before the first frame — every move, argument and vote. Then it plays out in about eighty seconds.",
  },
  {
    n: "02",
    h: "Read",
    p: "Each agent only knows what it personally witnessed. So do you. The tells are in who was where, and who is a little too sure about it.",
  },
  {
    n: "03",
    h: "Stake",
    p: "Back your pick with MON. The Imposter was committed on-chain before betting opened, so the answer was fixed before anyone could move it.",
  },
];

export function HowItWorks() {
  return (
    <Band tone="surface">
      <Eyebrow>How it works</Eyebrow>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 28,
        }}
      >
        {STEPS.map((s) => (
          <div key={s.n}>
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--color-accent-700)", marginBottom: 8 }}
            >
              {s.n}
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 20 }}>{s.h}</h3>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-neutral-700)", lineHeight: 1.5 }}>
              {s.p}
            </p>
          </div>
        ))}
      </div>
    </Band>
  );
}

/* ── The crew ──────────────────────────────────────────────────────────── */

export function Crew() {
  const { stats } = useStats();
  const played = stats.totals.resolved;

  return (
    <Band>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <Eyebrow>The crew</Eyebrow>
        <span
          className="mono"
          style={{ fontSize: 12, color: "var(--color-neutral-600)", marginBottom: 14 }}
        >
          {played > 0 ? `across ${played} settled ${played === 1 ? "game" : "games"}` : "no games settled yet"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 18,
        }}
      >
        {ROSTER.map((a, i) => {
          const s = stats.agents.find((x) => x.index === a.index);
          return (
            <div
              key={a.id}
              style={{
                background: "var(--color-neutral-100)",
                borderRadius: "var(--radius-lg)",
                padding: "18px 16px 14px",
                textAlign: "center",
              }}
            >
              <Crewmate hue={a.hue} badge={a.tag} duration={2.4 + i * 0.22} delay={i * 0.15} />
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, marginTop: 10 }}>
                {a.id}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{a.trait}</div>
              <div
                className="mono"
                style={{
                  marginTop: 10,
                  paddingTop: 9,
                  borderTop: "1px solid var(--color-neutral-300)",
                  fontSize: 11,
                  color: "var(--color-neutral-700)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span title="How often this agent was the Imposter">
                  lied {s?.timesImposter ?? 0}×
                </span>
                <span title="How often the crowd's money was on them when they were">
                  caught {s?.caught ?? 0}×
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Band>
  );
}

/* ── Live now ──────────────────────────────────────────────────────────── */

export function LiveNow() {
  const { stats, loading } = useStats();
  /* Matches still taking bets come first — those are the ones a visitor can
     actually do something about. */
  const now = useNow(2000);
  const open = stats.games
    .filter((g) => !g.resolved)
    .sort((a, b) => Number(b.startedAt > now) - Number(a.startedAt > now))
    .slice(0, 3);

  return (
    <Band>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Eyebrow>Live now</Eyebrow>
        <Link className="mono" href="/lobby" style={{ fontSize: 12, marginBottom: 14 }}>
          open the lobby →
        </Link>
      </div>

      {open.length === 0 ? (
        <Empty>
          {loading
            ? "Looking for open markets…"
            : "Nothing running. Start a match and it appears here for everyone."}
        </Empty>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {open.map((g) => (
            <Link
              key={g.numericId}
              href={`/game/${g.id}`}
              className="room room-interactive"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge badge-accent">
                  {g.startedAt > now ? "BETTING OPEN" : "LIVE"}
                </span>
                <span className="mono" style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                  {ago(g.startedAt)}
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, marginTop: 10 }}>
                Match #{g.numericId.slice(-4)}
              </div>
              <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>
                {mon(g.totalPool)} MON staked · {g.bettors.length}{" "}
                {g.bettors.length === 1 ? "bettor" : "bettors"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Band>
  );
}

/* ── Recent verdicts ───────────────────────────────────────────────────── */

export function Verdicts() {
  const { stats, loading } = useStats();
  const settled = stats.games.filter((g) => g.resolved && !g.abandoned).slice(0, 5);

  return (
    <Band tone="surface">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Eyebrow>Recent verdicts</Eyebrow>
        <Link className="mono" href="/lobby" style={{ fontSize: 12, marginBottom: 14 }}>
          all matches →
        </Link>
      </div>

      {settled.length === 0 ? (
        <Empty>
          {loading ? "Reading the chain…" : "No games have settled yet. Run one and it lands here."}
        </Empty>
      ) : (
        <div style={{ display: "grid", gap: 2, background: "var(--color-divider)" }}>
          {settled.map((g) => (
            <VerdictRow key={g.numericId} game={g} />
          ))}
        </div>
      )}
    </Band>
  );
}

function VerdictRow({ game }: { game: GameStat }) {
  const top = game.pools.indexOf(Math.max(...game.pools));
  const crowdRight = game.totalPool > 0 && top === game.imposterId;

  return (
    <div
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
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>
          {nameOf(game.imposterId)}
        </span>
        <span style={{ color: "var(--color-neutral-600)", fontSize: 14 }}> was the Imposter</span>
      </div>

      {game.totalPool > 0 ? (
        <span className={`badge ${crowdRight ? "badge-soft" : "badge-ghost"}`}>
          {crowdRight ? "CROWD READ IT" : "CROWD FOOLED"}
        </span>
      ) : (
        <span className="badge badge-ghost">NO BETS</span>
      )}

      <span className="mono" style={{ fontSize: 13 }}>
        {mon(game.totalPool)} MON
      </span>
      <span className="mono" style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
        {ago(game.startedAt)}
      </span>
    </div>
  );
}

/* ── Footer ────────────────────────────────────────────────────────────── */

export function Footer() {
  return (
    <Band tone="ink">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>
            IMPOSTER FLOOR
          </div>
          <div className="mono" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Monad testnet · chain 10143 · play money only
          </div>
        </div>
        <a
          className="mono"
          href={explorerTx(MARKET_ADDRESS).replace("/tx/", "/address/")}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: "var(--color-bg)", opacity: 0.8 }}
        >
          {MARKET_ADDRESS} ↗
        </a>
      </div>
    </Band>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        padding: "26px 0",
        fontSize: 13,
        color: "var(--color-neutral-600)",
      }}
    >
      {children}
    </div>
  );
}
