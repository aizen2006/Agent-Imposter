const NAV = ["Live", "Lobby", "Leaderboard", "My bets"];

export function TopBar({
  balance = "412.08 MON",
  address = "0x8f…21c",
}: {
  balance?: string;
  address?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "14px 22px",
        background: "var(--color-text)",
        color: "var(--color-bg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* brand mark — the crewmate reduced to a single accent bean */}
        <div
          style={{
            width: 26,
            height: 30,
            borderRadius: "14px 14px 11px 11px",
            background: "var(--color-accent)",
            position: "relative",
            flex: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 7,
              width: 17,
              height: 10,
              borderRadius: 6,
              background: "var(--visor)",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: 19,
            letterSpacing: "-.01em",
          }}
        >
          IMPOSTER FLOOR
        </span>
      </div>

      <nav style={{ display: "flex", gap: 4, marginLeft: 10 }}>
        {NAV.map((label, i) => (
          <a
            key={label}
            href="#"
            className="nav-pill"
            aria-current={i === 0 ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="wallet-pill" style={{ border: 0, color: "inherit" }}>
          <span className="mono" style={{ fontSize: 14 }}>
            {balance}
          </span>
          <span
            style={{
              width: 1,
              height: 14,
              background: "color-mix(in srgb, #f3f2f2 35%, transparent)",
            }}
          />
          <span className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
            {address}
          </span>
        </button>
      </div>
    </div>
  );
}
