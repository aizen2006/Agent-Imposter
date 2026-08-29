import { NextResponse } from "next/server";
import { reap } from "@/store/reap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Reveals any match whose playback has finished but which nobody resolved.

   Safe to call from anywhere and at any rate: it is rate-limited internally,
   idempotent, and every reveal is still checked against the on-chain
   commitment. Point a Vercel Cron at it, or just let /api/stats call it. */

export async function GET() {
  const result = await reap(true).catch(() => ({ checked: 0, resolved: [] }));
  return NextResponse.json({ ok: true, ...result });
}
