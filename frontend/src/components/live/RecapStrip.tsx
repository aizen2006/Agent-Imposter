import { Crewmate } from "@/components/Crewmate";
import type { Match } from "@/lib/match";

/** The ejected crewmate is drawn in burnt accent, not its own hue —
    it reads as a stamp rather than a character. */
const EJECTED = { body: "#4d170e", pack: "#7c1405" };

export function RecapStrip({ recap }: { recap: Match["recap"] }) {
  return (
    <div
      style={{
        padding: "20px 22px",
        background: "var(--color-accent)",
        color: "var(--color-bg)",
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <Crewmate
        hue={0}
        h={60}
        colors={EJECTED}
        motion="none"
        style={{ animation: "wobbleStamp 1.2s var(--ease)" }}
      />

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          {recap.kicker}
        </div>
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1.15,
          }}
        >
          {recap.headline}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{recap.detail}</div>
      </div>

      <button
        type="button"
        className="btn"
        style={{
          padding: "11px 20px",
          background: "var(--color-bg)",
          color: "var(--color-text)",
          fontSize: 14,
        }}
      >
        Watch the replay
      </button>
      <a
        href="#"
        className="mono"
        style={{ color: "var(--color-bg)", fontSize: 12, opacity: 0.85 }}
      >
        verify onchain ↗
      </a>
    </div>
  );
}
