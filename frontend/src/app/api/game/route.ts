import { NextResponse } from "next/server";
import { createGame } from "@/store/games";

export const runtime = "nodejs";
/** The whole match is generated here, before the first frame renders. */
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const llm = body?.llm !== false && Boolean(process.env.OPENAI_API_KEY);

  const started = Date.now();
  const game = await createGame({ llm });

  // Only ever the id. The Game object holds imposterId and salt (prd.md §6.3).
  return NextResponse.json({
    id: game.id,
    events: game.events.length,
    brain: llm ? "openai" : "stub",
    generatedInMs: Date.now() - started,
  });
}
