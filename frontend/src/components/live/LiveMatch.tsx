"use client";

import { useMemo, useState } from "react";
import { TopBar } from "./TopBar";
import { MatchBar } from "./MatchBar";
import { OfficeMap } from "./OfficeMap";
import { CrewStrip } from "./CrewStrip";
import { Market } from "./Market";
import { Chatter } from "./Chatter";
import { BetTicket } from "./BetTicket";
import { RecapStrip } from "./RecapStrip";
import { usePools } from "@/chain/useMarket";
import { AGENTS, type AgentId, type Match } from "@/lib/match";

export function LiveMatch({ match, marketId }: { match: Match; marketId?: bigint }) {
  const [selected, setSelected] = useState<AgentId>(match.market[0].agent);

  /* Shares and odds come from the contract, not the engine — humans decide
     them. The projection supplies the rows and the reasoning; the chain
     supplies the money. */
  const { pools, total } = usePools(marketId);
  const shown = useMemo(() => {
    if (total <= 0) return match;
    const market = match.market
      .map((o) => {
        const staked = pools[AGENTS[o.agent].index] ?? 0;
        return {
          ...o,
          share: Math.round((staked / total) * 100),
          odds: staked > 0 ? total / staked : match.market.length,
          leading: false,
        };
      })
      .sort((a, b) => b.share - a.share);
    if (market.length) market[0].leading = true;
    return { ...match, market, poolMon: total };
  }, [match, pools, total]);

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
        <MatchBar match={shown} />

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
            <OfficeMap rooms={shown.rooms} />
            <CrewStrip agents={shown.agents} />

            <div
              style={{
                height: 2,
                background: "var(--color-divider)",
                margin: "20px 0",
                borderRadius: 2,
              }}
            />

            <Market match={shown} selected={selected} onSelect={setSelected} />
          </div>

          <div
            style={{
              background: "var(--color-bg)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Chatter lines={shown.chatter} />
            <BetTicket match={shown} selected={selected} marketId={marketId} />
          </div>
        </div>

        <RecapStrip recap={shown.recap} />
      </div>
    </div>
  );
}
