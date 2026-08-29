"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Replay, Shell } from "./Replay";
import { useHandoff } from "@/lib/handoff";

/* The live match.

   The whole match was generated and projected server-side before this page
   loaded; it arrives through sessionStorage rather than over a connection.
   That is what makes it work on serverless — see store/games.ts. */

export function LiveGame({ id }: { id: string; speed?: number }) {
  const { ready, match } = useHandoff(id);

  /* Reveal on-chain when playback ends. The ticket is the sealed answer the
     server handed us at creation — opaque here, meaningful there. */
  const reveal = useCallback(() => {
    if (!match?.ticket) return;
    void fetch("/api/game/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket: match.ticket }),
    }).catch(() => {});
  }, [match]);

  if (!ready) return null;
  if (!match) return <Gone />;

  return (
    <Replay
      frames={match.frames}
      durations={match.durations}
      marketId={match.marketId ? BigInt(match.marketId) : undefined}
      onEnd={reveal}
    />
  );
}

function Gone() {
  return (
    <Shell>
      <h3 style={{ margin: 0 }}>That match isn&rsquo;t in this tab.</h3>
      <p style={{ color: "var(--color-neutral-700)", marginTop: 8 }}>
        Matches are generated on demand and played back in the tab that asked for
        them. Opening the link somewhere else starts from nothing.
      </p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 16, padding: "12px 24px" }}>
        Start a new one
      </Link>
    </Shell>
  );
}
