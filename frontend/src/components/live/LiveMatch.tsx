"use client";

import { useState } from "react";
import { TopBar } from "./TopBar";
import { MatchBar } from "./MatchBar";
import { OfficeMap } from "./OfficeMap";
import { CrewStrip } from "./CrewStrip";
import { Market } from "./Market";
import { Chatter } from "./Chatter";
import { BetTicket } from "./BetTicket";
import { RecapStrip } from "./RecapStrip";
import type { AgentId, Match } from "@/lib/match";

export function LiveMatch({ match }: { match: Match }) {
  const [selected, setSelected] = useState<AgentId>(match.market[0].agent);

  return (
    <div
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "28px 24px 64px",
        fontFamily: "var(--font-body)",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-shell)",
          overflow: "hidden",
          boxShadow: "var(--shadow-shell)",
        }}
      >
        <TopBar />
        <MatchBar match={match} />

        {/* The 2px gap is the divider — the panels sit on a tinted ground. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 400px",
            gap: 2,
            background: "var(--color-divider)",
          }}
        >
          <div style={{ background: "var(--color-bg)", padding: "20px 22px" }}>
            <OfficeMap rooms={match.rooms} />
            <CrewStrip agents={match.agents} />

            <div
              style={{
                height: 2,
                background: "var(--color-divider)",
                margin: "20px 0",
                borderRadius: 2,
              }}
            />

            <Market match={match} selected={selected} onSelect={setSelected} />
          </div>

          <div
            style={{
              background: "var(--color-bg)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Chatter lines={match.chatter} />
            <BetTicket match={match} selected={selected} />
          </div>
        </div>

        <RecapStrip recap={match.recap} />
      </div>
    </div>
  );
}
