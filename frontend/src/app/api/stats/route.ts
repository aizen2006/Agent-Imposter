import { NextResponse } from "next/server";
import { reap } from "@/store/reap";
import { buildStats } from "@/store/stats";

export const runtime = "nodejs";
/* Dynamic, not ISR. `revalidate` would prerender this at build time — when the
   store is necessarily empty — and serve that snapshot to the first visitor
   after every deploy. buildStats() does its own short-TTL caching, so being
   dynamic costs nothing and is never stale in a way anyone notices. */
export const dynamic = "force-dynamic";

/* Feeds the home page, the leaderboard and the lobby from one place.

   Everything here is recomputed from contract view calls — the match store
   only says which games exist and where their bets landed (prd.md §15.4). If
   the store is empty or the RPC is unreachable the response is well-formed and
   empty, so every surface renders its own "nothing yet" state rather than
   breaking. */

export async function GET() {
  /* Settle anything that finished while nobody was watching. Rate-limited
     internally, so the lobby polling this is not a problem — it means a busy
     floor keeps itself resolved without a cron (prd.md §16). */
  void reap().catch(() => {});

  const stats = await buildStats().catch(() => null);

  if (!stats) {
    return NextResponse.json({
      games: [],
      leaders: [],
      totals: { openMarkets: 0, staked: 0, resolved: 0, players: 0 },
      agents: Array.from({ length: 6 }, (_, index) => ({
        index,
        timesImposter: 0,
        caught: 0,
      })),
    });
  }

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
  });
}
