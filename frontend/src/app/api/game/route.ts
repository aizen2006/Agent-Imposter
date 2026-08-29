import { NextResponse } from "next/server";
import { openMarket } from "@/chain/resolver";
import { seal } from "@/chain/ticket";
import { project } from "@/engine/project";
import { planPlayback } from "@/engine/timing";
import { createGame } from "@/store/games";
import { putMatch, sweep } from "@/store/matches";

export const runtime = "nodejs";
/** Generation is the only slow part: ~23s with real models, ~1s with the stub.
    60 is Vercel's Hobby ceiling; asking for more there is silently clamped. */
export const maxDuration = 60;

/* Creates a match and hands back the whole thing, already projected.

   The frames are redacted snapshots — the same `Match` objects the UI used to
   receive one at a time over SSE. Sending them all at once removes the only
   two things that could not work on serverless: server-held state between
   requests, and a connection held open longer than a function may live.

   ~7 KB gzipped for a full match, so this is cheaper than the stream it
   replaces. Playback is still simulate-then-replay; only the transport moved. */

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const llm = body?.llm !== false && Boolean(process.env.OPENAI_API_KEY);

  const started = Date.now();
  const game = await createGame({ llm });

  // Commit the Imposter on-chain before anyone can stake. Best-effort: a
  // missing key or a flaky RPC degrades to an off-chain game rather than
  // failing the request (prd.md §27).
  const market = await openMarket(game).catch((err: unknown) => ({
    ok: false as const,
    reason: err instanceof Error ? err.message.split("\n")[0] : "chain unavailable",
  }));

  const { durations, totalMs, closesAtMs } = planPlayback(game.events);

  /* revealAt is sealed with the answer, so a ticket stored publicly beside the
     frames still cannot be used to end a match early (prd.md §15.1). */
  const ticket = seal(
    game.numericId,
    game.imposterId,
    game.salt,
    Date.now() + Math.round(totalMs) - 2000,
  );
  const matchId = Number(game.numericId % BigInt(10000));

  let elapsed = 0;
  const frames = game.events.map((_, i) => {
    elapsed += durations[i];
    return project(game.events, i + 1, {
      matchId,
      closesIn: Math.max(0, Math.round((closesAtMs - elapsed) / 1000)),
      spectators: 1 + (game.seed % 1500),
    });
  });

  /* Publish so anyone can watch, not only whoever pressed the button
     (prd.md §15.2). Best-effort: with no blob token this returns null and the
     match simply stays local, which is the behaviour it replaces. */
  const startedAt = Date.now();
  const shared = await putMatch({
    id: game.id,
    numericId: game.numericId.toString(),
    createdBlock: market.ok && market.block ? market.block : 0,
    startedAt,
    durationMs: Math.round(totalMs),
    frames,
    durations,
    ticket,
  });
  if (shared) void sweep().catch(() => {});

  return NextResponse.json({
    id: game.id,
    shared: Boolean(shared),
    startedAt,
    marketId: game.numericId.toString(),
    events: game.events.length,
    brain: llm ? "openai" : "stub",
    generatedInMs: Date.now() - started,
    market: market.ok
      ? { open: true, hash: market.hash }
      : { open: false, reason: market.reason },

    // Redacted snapshots. `Match` has no field that can hold imposterId, which
    // is what makes this safe to hand to a browser at all (prd.md §6.3).
    frames,
    durations,
    totalMs: Math.round(totalMs),

    // The answer, encrypted with a key only the server holds. The browser
    // carries it through playback and hands it back to reveal. Opaque to it.
    ticket,
  });
}
