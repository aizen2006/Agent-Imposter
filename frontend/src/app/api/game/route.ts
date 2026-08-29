import { NextResponse } from "next/server";
import { openMarket } from "@/chain/resolver";
import { createGame } from "@/store/games";

export const runtime = "nodejs";
/** The whole match is generated here, before the first frame renders. */
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const llm = body?.llm !== false && Boolean(process.env.OPENAI_API_KEY);

  const started = Date.now();
  const game = await createGame({ llm });

  // Commit the Imposter on-chain before anyone can stake. Best-effort: a
  // missing key or a flaky RPC degrades to an off-chain game rather than
  // failing the request (prd.md §27). Nothing about the chain may take the
  // game down — that is the whole reason settlement is decoupled.
  const market = await openMarket(game).catch((err: unknown) => ({
    ok: false as const,
    reason: err instanceof Error ? err.message.split("\n")[0] : "chain unavailable",
  }));

  // Only ever the id and the public market handle. The Game object holds
  // imposterId and salt, and neither leaves this process (prd.md §6.3).
  return NextResponse.json({
    id: game.id,
    marketId: game.numericId.toString(),
    events: game.events.length,
    brain: llm ? "openai" : "stub",
    generatedInMs: Date.now() - started,
    market: market.ok
      ? { open: true, hash: market.hash }
      : { open: false, reason: market.reason },
  });
}
