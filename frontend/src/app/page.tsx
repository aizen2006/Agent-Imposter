import { StartMatch } from "@/components/StartMatch";
import { Crew, Footer, Hero, HowItWorks, LiveNow, Rule, Verdicts } from "@/components/home/Bands";
import Link from "next/link";

/* The lobby page (prd.md §15.3).

   Six bands separated by 2px rules, per design.md §9 — the grid is meant to
   show. Everything below the hero is fed by contract reads, so the page is
   honest when there is nothing to report: each band renders its own empty
   state rather than a plausible-looking zero. */

export default function Home() {
  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 24px 64px", width: "100%" }}>
      <div
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-shell)",
          boxShadow: "var(--shadow-shell)",
          overflow: "hidden",
        }}
      >
        <Hero />

        {/* The action sits directly under the pitch, above every other band. */}
        <div style={{ padding: "0 48px 44px", background: "var(--color-bg)" }}>
          <StartMatch />
          <div style={{ marginTop: 16, display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Link className="mono" href="/game/golden" style={{ fontSize: 12 }}>
              watch a recorded match ↗
            </Link>
            <Link className="mono" href="/leaderboard" style={{ fontSize: 12 }}>
              leaderboard ↗
            </Link>
          </div>
        </div>

        <Rule />
        <HowItWorks />
        <Rule />
        <LiveNow />
        <Rule />
        <Crew />
        <Rule />
        <Verdicts />
        <Rule />
        <Footer />
      </div>
    </div>
  );
}
