import "server-only";

import { createPublicClient, createWalletClient, encodePacked, http, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { marketAbi } from "./abi";
import { MARKET_ADDRESS, TESTNET_ID, monadTestnet } from "./monad";
import type { AgentIndex, Game } from "@/engine/types";

/* The trusted resolver (prd.md §27). It creates the on-chain market when a
   match is generated and reveals the Imposter when playback ends.

   Everything here is best-effort. If RESOLVER_PK is unset or a transaction
   fails, the game still plays — the chain is a settlement layer, not the
   critical path of the demo. A hard dependency here would mean a flaky RPC
   could take down the whole product on stage.

   This is the only code in the app that signs without a human approving it,
   so it is also the only code that can lose real money if it is ever pointed
   at Monad mainnet. Every write goes through onTestnet() first. */

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });

/** Asks the RPC what chain it actually is, rather than trusting the chain
    object we handed it. Cached after the first success — the answer cannot
    change for a given endpoint, and this sits in front of every transaction. */
let chainOk: boolean | null = null;
async function onTestnet(): Promise<boolean> {
  if (chainOk !== null) return chainOk;
  try {
    const id = await publicClient.getChainId();
    if (id !== TESTNET_ID) {
      // Do not cache a mismatch as a soft failure — this is a config error.
      chainOk = false;
      console.error(
        `[resolver] RPC reports chain ${id}, expected Monad testnet ${TESTNET_ID}. ` +
          "Refusing to sign anything. Check the RPC endpoint.",
      );
      return false;
    }
    chainOk = true;
    return true;
  } catch {
    // Unreachable RPC is not a wrong chain. Leave uncached so it retries,
    // and let the write below fail on its own with a useful message.
    return false;
  }
}

/** Never throws. A malformed key is a misconfiguration, not a reason to fail
    a request — the whole point of this module is that the chain is optional. */
let warned = false;
function wallet() {
  const raw = process.env.RESOLVER_PK?.trim();
  if (!raw) return null;

  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    if (!warned) {
      warned = true;
      // Never log the value itself, even partially.
      console.warn(
        "[resolver] RESOLVER_PK is set but is not a 32-byte hex private key — " +
          "running off-chain. Expected 64 hex characters, optionally 0x-prefixed.",
      );
    }
    return null;
  }

  try {
    return createWalletClient({
      account: privateKeyToAccount(key),
      chain: monadTestnet,
      transport: http(),
    });
  } catch {
    if (!warned) {
      warned = true;
      console.warn("[resolver] RESOLVER_PK rejected by viem — running off-chain.");
    }
    return null;
  }
}

const contract = { address: MARKET_ADDRESS, abi: marketAbi } as const;

/** keccak256(abi.encodePacked(gameId, imposterId, salt)).
    encodePacked, NOT encodeAbiParameters — a mismatch fails at resolve() with
    "commitment mismatch", which is a miserable thing to debug live. */
export function commitmentFor(
  gameId: bigint,
  imposterId: AgentIndex,
  salt: `0x${string}`,
): `0x${string}` {
  return keccak256(encodePacked(["uint256", "uint8", "bytes32"], [gameId, imposterId, salt]));
}

/** Asserts our encoding matches the contract's, using its own pure helper.
    Cheap, free, and turns a runtime surprise into a startup failure. */
export async function verifyCommitmentEncoding(
  gameId: bigint,
  imposterId: AgentIndex,
  salt: `0x${string}`,
): Promise<boolean> {
  try {
    const onchain = await publicClient.readContract({
      ...contract,
      functionName: "commitmentFor",
      args: [gameId, imposterId, salt],
    });
    return onchain === commitmentFor(gameId, imposterId, salt);
  } catch {
    return false; // RPC unreachable — not an encoding failure, so do not block
  }
}

export type ChainResult = { ok: boolean; hash?: `0x${string}`; reason?: string };

/** Opens the market. The imposter is committed here, before a single MON is
    staked, so the outcome is provably fixed in advance. */
export async function openMarket(game: Game, windowSeconds = 300): Promise<ChainResult> {
  const client = wallet();
  if (!client) return { ok: false, reason: "resolver wallet unavailable" };
  if (!(await onTestnet())) return { ok: false, reason: "not on Monad testnet" };

  const commitment = commitmentFor(game.numericId, game.imposterId, game.salt);
  const matches = await verifyCommitmentEncoding(game.numericId, game.imposterId, game.salt);
  if (!matches) {
    console.warn("[resolver] commitment encoding disagrees with the contract — not creating");
    return { ok: false, reason: "commitment encoding mismatch" };
  }

  try {
    const closeAt = BigInt(Math.floor(Date.now() / 1000) + windowSeconds);
    const hash = await client.writeContract({
      ...contract,
      functionName: "createGame",
      args: [game.numericId, closeAt, commitment],
    });
    return { ok: true, hash };
  } catch (err) {
    const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
    console.warn(`[resolver] createGame failed: ${reason}`);
    return { ok: false, reason };
  }
}

/** Reveals the Imposter. Also hard-closes betting, which is what makes an
    early crew win settle immediately rather than waiting out the clock.

    Takes the three fields rather than a Game because on serverless the reveal
    arrives as a sealed ticket, not as the object that generated it. */
export async function settleMarket(game: {
  numericId: bigint;
  imposterId: AgentIndex;
  salt: `0x${string}`;
}): Promise<ChainResult> {
  const client = wallet();
  if (!client) return { ok: false, reason: "resolver wallet unavailable" };
  if (!(await onTestnet())) return { ok: false, reason: "not on Monad testnet" };

  try {
    const hash = await client.writeContract({
      ...contract,
      functionName: "resolve",
      args: [game.numericId, game.imposterId, game.salt],
    });
    return { ok: true, hash };
  } catch (err) {
    const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
    // "already resolved" is expected: every viewer's stream ends and tries.
    if (!/already resolved/i.test(reason)) {
      console.warn(`[resolver] resolve failed: ${reason}`);
    }
    return { ok: false, reason };
  }
}
