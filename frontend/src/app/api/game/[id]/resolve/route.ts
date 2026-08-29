import { NextResponse } from "next/server";
import { settleMarket } from "@/chain/resolver";
import { getGame } from "@/store/games";

export const runtime = "nodejs";

/* Called when a viewer's playback reaches the end. Every viewer will hit this,
   so it must be idempotent — the contract rejects a second resolve with
   "already resolved", which resolver.ts treats as expected rather than noise. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return NextResponse.json({ ok: false, reason: "no such game" }, { status: 404 });

  const result = await settleMarket(game);

  // The Imposter is public the moment RESOLVED has played, and the reveal has
  // already reached this viewer through the stream.
  return NextResponse.json({
    ...result,
    imposterId: game.imposterId,
    crewWon: game.crewWon,
  });
}
