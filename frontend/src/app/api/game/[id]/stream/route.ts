import { project } from "@/engine/project";
import { planPlayback } from "@/engine/timing";
import { getGame } from "@/store/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Playback (prd.md §2.1 / §7.1).

   The match already exists in full. This walks its event log on a timer and
   pushes a projected snapshot after each one, so the browser sees a live game
   without ever waiting on a model. Nothing here can stall: the hard work
   finished before the first byte.

   Snapshots are sent rather than raw events — `Match` has no field that can
   carry imposterId, which is what makes the redaction structural.

   The timing table lives in engine/timing.ts because the golden-game fallback
   replays through the same one. */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return new Response("no such game", { status: 404 });

  const url = new URL(req.url);
  const { durations, totalMs, closesAtMs } = planPlayback(
    game.events,
    Number(url.searchParams.get("speed") ?? 1),
  );

  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (cancelled) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("meta", {
        id: game.id,
        marketId: game.numericId.toString(),
        events: game.events.length,
        totalMs: Math.round(totalMs),
        closesInMs: Math.round(closesAtMs),
      });

      let elapsed = 0;
      for (let i = 0; i < game.events.length; i++) {
        if (cancelled) break;
        await sleep(durations[i]);
        elapsed += durations[i];

        send(
          "frame",
          project(game.events, i + 1, {
            matchId: Number(game.numericId % BigInt(10000)),
            closesIn: Math.max(0, Math.round((closesAtMs - elapsed) / 1000)),
            spectators: 1 + (game.seed % 1500),
          }),
        );
      }

      send("done", { crewWon: game.crewWon });
      if (!cancelled) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx and friends will happily buffer an SSE stream into uselessness.
      "X-Accel-Buffering": "no",
    },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
