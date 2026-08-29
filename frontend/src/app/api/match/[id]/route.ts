import { NextResponse } from "next/server";
import { getMatch } from "@/store/matches";

export const runtime = "nodejs";

/* Serves a shared match to anyone who did not generate it (prd.md §15.2).

   Frames only — already redacted, so this is safe to hand to a stranger. The
   sealed ticket goes with them so playback can still trigger the reveal when
   the original creator has closed their tab; it is ciphertext, and it refuses
   to open before the match could have finished. */

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 });

  return NextResponse.json(match, {
    // Frames never change once written, so let the edge keep them.
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
