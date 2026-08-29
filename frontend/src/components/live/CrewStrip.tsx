import { CrewBlob } from "@/components/Crewmate";
import type { Agent } from "@/lib/match";

export function CrewStrip({ agents }: { agents: Agent[] }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
      {agents.map((a) => (
        <div
          key={a.id}
          className={[
            "crew-pill",
            a.flagged && a.alive && "crew-pill-flagged",
            !a.alive && "crew-pill-dead",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <CrewBlob hue={a.hue} h={22} w={20} dead={!a.alive} />
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 12,
              textDecoration: a.alive ? undefined : "line-through",
            }}
          >
            {a.id}
          </span>
          <span
            style={{
              fontSize: 10,
              color:
                a.flagged && a.alive
                  ? "var(--color-accent-700)"
                  : "var(--color-neutral-600)",
            }}
          >
            {a.flagged && a.alive ? a.flag : a.trait}
          </span>
        </div>
      ))}
    </div>
  );
}
