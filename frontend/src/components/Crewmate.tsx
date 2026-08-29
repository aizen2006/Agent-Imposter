import type { CSSProperties } from "react";

/** Body and pack are the same hue at two fixed lightness steps. */
export const bodyColor = (hue: number) => `oklch(0.62 0.09 ${hue})`;
export const packColor = (hue: number) => `oklch(0.52 0.09 ${hue})`;

/* ── Full crewmate ─────────────────────────────────────────────────────────
   Drawn at a base height of 44px and scaled proportionally, so every call
   site keeps the same silhouette. Used on the office map and the reveal. */

type CrewmateProps = {
  hue: number;
  /** Rendered height in px. Everything else scales from this. */
  h?: number;
  /** Letter shown on the tag above the head. */
  badge?: string;
  /** Accent tag marks an agent under active suspicion. */
  badgeAccent?: boolean;
  /** Ring drawn around the body — the "currently accused" state. */
  accused?: boolean;
  /** Idle motion. `waddle` reads as walking, `bob` as standing around. */
  motion?: "bob" | "waddle" | "none";
  /** Stagger so a room full of crew doesn't move in lockstep. */
  duration?: number;
  delay?: number;
  /** Override the palette — the reveal strip uses a burnt accent version. */
  colors?: { body: string; pack: string; visor?: string };
  style?: CSSProperties;
};

export function Crewmate({
  hue,
  h = 44,
  badge,
  badgeAccent = false,
  accused = false,
  motion = "bob",
  duration = 2.8,
  delay = 0,
  colors,
  style,
}: CrewmateProps) {
  const s = h / 44;
  const px = (n: number) => `${n * s}px`;
  const w = 38 * s;

  const body = colors?.body ?? bodyColor(hue);
  const pack = colors?.pack ?? packColor(hue);
  const visor = colors?.visor ?? "var(--visor)";

  return (
    <div
      style={{
        position: "relative",
        width: `${w}px`,
        height: `${h}px`,
        flex: "none",
        animation:
          motion === "none"
            ? undefined
            : `${motion} ${duration}s ease-in-out infinite`,
        animationDelay: delay ? `${delay}s` : undefined,
        ...style,
      }}
    >
      {/* backpack */}
      <div
        style={{
          position: "absolute",
          left: px(-7),
          top: px(12),
          width: px(11),
          height: px(20),
          borderRadius: px(6),
          background: pack,
        }}
      />
      {/* body */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: `${px(19)} ${px(19)} ${px(14)} ${px(14)}`,
          background: body,
          boxShadow: `inset 0 ${px(-6)} 0 rgba(0,0,0,.09)`,
          outline: accused ? "3px solid var(--color-accent)" : undefined,
          outlineOffset: accused ? "3px" : undefined,
        }}
      />
      {/* visor, with a light sweep across it */}
      <div
        style={{
          position: "absolute",
          left: px(9),
          top: px(10),
          width: px(26),
          height: px(14),
          borderRadius: px(8),
          background: visor,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: px(8),
            height: "100%",
            background: "#fff",
            opacity: 0.7,
            animation: `shine ${duration + 0.4}s ease-in-out infinite`,
          }}
        />
      </div>
      {/* legs */}
      <div
        style={{
          position: "absolute",
          left: px(6),
          bottom: px(-4),
          width: px(10),
          height: px(6),
          borderRadius: `0 0 ${px(5)} ${px(5)}`,
          background: pack,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: px(6),
          bottom: px(-4),
          width: px(10),
          height: px(6),
          borderRadius: `0 0 ${px(5)} ${px(5)}`,
          background: pack,
        }}
      />
      {badge && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: px(-13),
            font: `800 ${px(9)} var(--font-heading)`,
            background: badgeAccent ? "var(--color-accent)" : "var(--color-text)",
            color: "var(--color-bg)",
            padding: `${px(1)} ${px(6)}`,
            borderRadius: "var(--radius-pill)",
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
}

/* ── Eliminated crewmate ───────────────────────────────────────────────────
   Tipped on its side, drained of colour. No pack, no legs. */

export function CrewmateGhost({ h = 44 }: { h?: number }) {
  const s = h / 44;
  const px = (n: number) => `${n * s}px`;

  return (
    <div
      style={{
        position: "relative",
        width: `${38 * s}px`,
        height: `${h}px`,
        flex: "none",
        opacity: 0.45,
        transform: "rotate(90deg)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: `${px(19)} ${px(19)} ${px(14)} ${px(14)}`,
          background: "var(--color-neutral-500)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: px(9),
          top: px(10),
          width: px(26),
          height: px(14),
          borderRadius: px(8),
          background: "var(--color-neutral-300)",
        }}
      />
    </div>
  );
}

/* ── Blob ──────────────────────────────────────────────────────────────────
   The crewmate reduced to a silhouette: no visor, no legs. Used wherever an
   agent needs identifying at small size — market rows, chat, crew pills. */

type BlobProps = {
  hue?: number;
  h: number;
  /** Defaults to the crewmate's 38:44 proportion. */
  w?: number;
  dead?: boolean;
  accused?: boolean;
  motion?: boolean;
  style?: CSSProperties;
};

export function CrewBlob({
  hue = 0,
  h,
  w,
  dead = false,
  accused = false,
  motion = false,
  style,
}: BlobProps) {
  const width = w ?? Math.round((h * 38) / 44);
  return (
    <span
      style={{
        display: "block",
        width: `${width}px`,
        height: `${h}px`,
        flex: "none",
        borderRadius: `${width / 2}px ${width / 2}px ${Math.round(h * 0.34)}px ${Math.round(h * 0.34)}px`,
        background: dead ? "var(--color-neutral-500)" : bodyColor(hue),
        outline: accused ? "2px solid var(--color-accent)" : undefined,
        outlineOffset: accused ? "2px" : undefined,
        animation: motion ? "bob 3s ease-in-out infinite" : undefined,
        ...style,
      }}
    />
  );
}
