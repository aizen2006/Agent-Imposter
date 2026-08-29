"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PreMatch } from "./PreMatch";
import { Replay, Shell } from "./Replay";
import { useHandoff, type Handoff } from "@/lib/handoff";

/* A match, in whichever of its three phases it is in.

   Betting window -> playback -> over. Which one you get is decided purely by
   comparing the wall clock to startedAt, so every viewer is on the same frame
   at the same moment without anything being synchronised over a wire. That is
   what makes several people able to bet into one pool rather than each of them
   playing their own game (prd.md §16).

   Two ways in. Whoever pressed the button already has the frames in their tab,
   so nothing is fetched. Everyone else pulls the same match from the shared
   store. */

type Remote = { kind: "loading" } | { kind: "ready"; match: Handoff } | { kind: "gone" };

export function LiveGame({ id }: { id: string; speed?: number }) {
  const { ready, match: local } = useHandoff(id);
  const [remote, setRemote] = useState<Remote>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ready || local) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/match/${id}`);
        if (!res.ok) throw new Error("404");
        const m = await res.json();
        if (cancelled) return;

        setRemote({
          kind: "ready",
          match: {
            id: m.id,
            marketId: m.numericId,
            startedAt: m.startedAt,
            frames: m.frames,
            durations: m.durations,
            pauseBefore: m.pauseBefore,
            ticket: m.ticket ?? null,
            brain: "shared",
            market: { open: true },
          },
        });
      } catch {
        if (!cancelled) setRemote({ kind: "gone" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, ready, local]);

  const match = local ?? (remote.kind === "ready" ? remote.match : null);

  /* Reveal on-chain when playback ends. The ticket is the sealed answer the
     server handed out — opaque here, meaningful there, and it refuses to open
     before the match could have finished. */
  const reveal = useCallback(() => {
    if (!match?.ticket) return;
    void fetch("/api/game/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket: match.ticket }),
    }).catch(() => {});
  }, [match]);

  const begin = useCallback(() => setNow(Date.now()), []);

  if (!ready) return null;
  if (!match) return remote.kind === "gone" ? <Gone /> : null;

  const startAt = match.startedAt ?? 0;
  const marketId = match.marketId ? BigInt(match.marketId) : undefined;

  // Doors still open: bet against the opening board.
  if (startAt > now) {
    return (
      <PreMatch
        match={match.frames[0]}
        marketId={marketId}
        startAt={startAt}
        onStart={begin}
      />
    );
  }

  return (
    <Replay
      frames={match.frames}
      durations={match.durations}
      pauseBefore={match.pauseBefore}
      marketId={marketId}
      // Everyone lands on the frame the clock says, whenever they arrived.
      startAtMs={Math.max(0, now - startAt)}
      onEnd={reveal}
    />
  );
}

function Gone() {
  return (
    <Shell>
      <h3 style={{ margin: 0 }}>No such match.</h3>
      <p style={{ color: "var(--color-neutral-700)", marginTop: 8 }}>
        Matches are kept for a day. This one has either expired or was never
        shared.
      </p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 16, padding: "12px 24px" }}>
        Start a new one
      </Link>
    </Shell>
  );
}
