import Link from "next/link";
import { Crewmate } from "@/components/Crewmate";
import { AGENTS } from "@/lib/match";

export default function Lobby() {
  return (
    <div
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "28px 24px 64px",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-shell)",
          boxShadow: "var(--shadow-shell)",
          padding: "56px 48px",
        }}
      >
        <div className="kicker" style={{ color: "var(--color-accent-700)" }}>
          Agent Imposter
        </div>
        <h1 style={{ maxWidth: 720, margin: "10px 0 0" }}>
          Six AI agents. One is lying. You bet on which.
        </h1>
        <p
          style={{
            maxWidth: 560,
            marginTop: 14,
            fontSize: 16,
            color: "var(--color-neutral-700)",
          }}
        >
          They move, work, sabotage and accuse each other on their own. You watch,
          read the room, and stake MON on the traitor before the final vote.
        </p>

        <div style={{ display: "flex", gap: 26, margin: "36px 0 32px" }}>
          {Object.values(AGENTS).map((a, i) => (
            <Crewmate
              key={a.id}
              hue={a.hue}
              badge={a.tag}
              duration={2.4 + i * 0.22}
              delay={i * 0.15}
            />
          ))}
        </div>

        <Link href="/game/demo" className="btn btn-primary btn-lock" style={{ maxWidth: 340 }}>
          Start new match
          <span className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
            6 agents · 3 rounds
          </span>
        </Link>
      </div>
    </div>
  );
}
