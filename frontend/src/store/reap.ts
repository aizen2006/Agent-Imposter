import "server-only";

import { createPublicClient, http } from "viem";
import { marketAbi } from "@/chain/abi";
import { MARKET_ADDRESS, monadTestnet } from "@/chain/monad";
import { settleMarket } from "@/chain/resolver";
import { unseal } from "@/chain/ticket";
import { getMatch, listMatches } from "./matches";

/* Reveals matches nobody is watching (prd.md §16).

   Resolution used to depend on a browser tab reaching the end of playback. In
   a single-player toy that is fine; in a market it is not. If the one person
   who started a match closes the tab, everyone else's stake sits unresolved
   until the 24h abandon() window — so the reveal has to happen whether or not
   anyone is looking.

   This runs off the stored ticket, which is why the ticket is stored at all.
   Called opportunistically from /api/stats, which the lobby polls, so a busy
   floor reaps itself. /api/reap exposes it for a cron on top of that.

   Every guard still applies: the ticket refuses to open before the match could
   have finished, and the contract verifies the reveal against the commitment
   posted before betting opened. */

const client = createPublicClient({
  chain: monadTestnet,
  transport: http(),
  batch: { multicall: true },
});

/** Don't re-attempt a match this process has already settled or given up on. */
const done = new Set<string>();
let lastRun = 0;
const MIN_GAP_MS = 20_000;

export async function reap(force = false): Promise<{ checked: number; resolved: string[] }> {
  if (!force && Date.now() - lastRun < MIN_GAP_MS) return { checked: 0, resolved: [] };
  lastRun = Date.now();

  const resolved: string[] = [];
  try {
    const metas = await listMatches(25);

    // Only matches whose playback is genuinely over are candidates.
    const over = metas.filter(
      (m) => !done.has(m.numericId) && Date.now() > m.startedAt + m.durationMs,
    );
    if (over.length === 0) return { checked: 0, resolved };

    const states = await client.multicall({
      contracts: over.map((m) => ({
        ...{ address: MARKET_ADDRESS, abi: marketAbi },
        functionName: "games" as const,
        args: [BigInt(m.numericId)],
      })),
    });

    for (let i = 0; i < over.length; i++) {
      const state = states[i];
      if (state.status !== "success") continue;

      const [, exists, isResolved] = state.result as readonly [
        bigint, boolean, boolean, boolean, number, `0x${string}`, bigint,
      ];
      if (!exists || isResolved) {
        done.add(over[i].numericId);
        continue;
      }

      const match = await getMatch(over[i].id);
      const opened = match?.ticket ? unseal(match.ticket) : null;
      if (!opened || opened === "early") continue;

      const result = await settleMarket({
        numericId: opened.gameId,
        imposterId: opened.imposterId,
        salt: opened.salt,
      });
      // "already resolved" means someone's tab beat us to it — also done.
      if (result.ok || result.reason === "already resolved") {
        done.add(over[i].numericId);
        if (result.ok) resolved.push(over[i].id);
      }
    }

    return { checked: over.length, resolved };
  } catch {
    return { checked: 0, resolved };
  }
}
