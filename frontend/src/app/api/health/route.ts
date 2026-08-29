import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { MARKET_ADDRESS, TESTNET_ID, monadTestnet } from "@/chain/monad";
import { storageStatus } from "@/store/matches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* One request that answers "is this deployment actually going to work?".

   Every subsystem here is optional by design, which is a strength right up
   until one of them is quietly off and you find out from a stranger whose
   shared link 404'd on their phone. Check this before demoing.

   Nothing secret is returned — only whether each piece is configured. */

const firstLine = (err: unknown) =>
  err instanceof Error ? err.message.split("\n")[0] : "unreachable";

export async function GET() {
  const storage = storageStatus();

  let chain: { ok: boolean; chainId?: number; reason?: string };
  try {
    const client = createPublicClient({ chain: monadTestnet, transport: http() });
    const id = await client.getChainId();
    chain =
      id === TESTNET_ID
        ? { ok: true, chainId: id }
        : { ok: false, chainId: id, reason: `expected Monad testnet ${TESTNET_ID}` };
  } catch (err) {
    chain = { ok: false, reason: firstLine(err) };
  }

  const pk = process.env.RESOLVER_PK?.trim() ?? "";
  const resolver = /^(0x)?[0-9a-fA-F]{64}$/.test(pk)
    ? { ok: true }
    : { ok: false, reason: pk ? "not a 32-byte hex private key" : "RESOLVER_PK not set" };

  const agents = process.env.OPENAI_API_KEY
    ? { ok: true, brain: "openai" }
    : { ok: false, brain: "stub", reason: "OPENAI_API_KEY not set — dialogue will be templated" };

  return NextResponse.json({
    ok: storage.ok && chain.ok && resolver.ok,
    contract: MARKET_ADDRESS,
    // Sharing off means every match is private: links will 404 elsewhere.
    multiplayer: storage,
    chain,
    resolver,
    agents,
  });
}
