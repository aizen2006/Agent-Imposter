"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Replay, Shell } from "./Replay";
import { useHandoff, type Handoff } from "@/lib/handoff";

/* The live match.

   Two ways in. Whoever pressed the button already has the frames in their tab,
   so their playback starts with no round trip. Everyone else fetches the same
   match from the shared store and seeks to wherever it has got to — which is
   what makes several people able to watch one game, and therefore what makes
   the pool mean anything (prd.md §15.0). */

type State =
  | { kind: "loading" }
  | { kind: "playing"; match: Handoff; startAt: number }
  | { kind: "gone" };

export function LiveGame({ id }: { id: string; speed?: number }) {
  const { ready, match: local } = useHandoff(id);
  const [remote, setRemote] = useState<State>({ kind: "loading" });

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
          kind: "playing",
          match: {
            id: m.id,
            marketId: m.numericId,
            frames: m.frames,
            durations: m.durations,
            ticket: m.ticket ?? null,
            brain: "shared",
            market: { open: true },
          },
          // Join where the match actually is, not at the beginning.
          startAt: Date.now() - m.startedAt,
        });
      } catch {
        if (!cancelled) setRemote({ kind: "gone" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, ready, local]);

  const active = local ?? (remote.kind === "playing" ? remote.match : null);

  /* Reveal on-chain when playback ends. The ticket is the sealed answer the
     server handed out — opaque here, meaningful there, and it refuses to open
     before the match could have finished. */
  const reveal = useCallback(() => {
    if (!active?.ticket) return;
    void fetch("/api/game/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket: active.ticket }),
    }).catch(() => {});
  }, [active]);

  if (!ready) return null;
  if (!active) return remote.kind === "gone" ? <Gone /> : null;

  return (
    <Replay
      frames={active.frames}
      durations={active.durations}
      marketId={active.marketId ? BigInt(active.marketId) : undefined}
      startAtMs={local ? 0 : remote.kind === "playing" ? remote.startAt : 0}
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
