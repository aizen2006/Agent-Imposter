import { NextResponse } from "next/server";
import { settleMarket } from "@/chain/resolver";
import { unseal } from "@/chain/ticket";

export const runtime = "nodejs";

/* Reveals the Imposter on-chain.

   Stateless: the answer arrives back as the sealed ticket handed out at
   creation, so this works on whichever lambda happens to serve the request.
   Every viewer's playback ends and every viewer calls this, so it must be
   idempotent — the contract rejects the second one with "already resolved",
   which resolver.ts treats as expected rather than as an error.

   A forged ticket cannot make this lie. AES-GCM authentication rejects
   tampering, and even past that the contract checks the reveal against the
   commitment posted before betting opened. */

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ticket = typeof body?.ticket === "string" ? body.ticket : null;
  if (!ticket) return NextResponse.json({ ok: false, reason: "no ticket" }, { status: 400 });

  const opened = unseal(ticket);
  if (!opened) return NextResponse.json({ ok: false, reason: "bad ticket" }, { status: 400 });
  // A real ticket presented before its match could have finished. Tickets are
  // stored publicly beside the frames, so without this anyone could close
  // betting the moment a match opened.
  if (opened === "early") {
    return NextResponse.json({ ok: false, reason: "too early" }, { status: 425 });
  }

  const result = await settleMarket({
    numericId: opened.gameId,
    imposterId: opened.imposterId,
    salt: opened.salt,
  }).catch((err: unknown) => ({
    ok: false as const,
    reason: err instanceof Error ? err.message.split("\n")[0] : "chain unavailable",
  }));

  return NextResponse.json(result);
}
