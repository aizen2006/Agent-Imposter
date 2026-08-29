import "server-only";

import { createPublicClient, formatEther, http, parseAbiItem } from "viem";
import { marketAbi } from "@/chain/abi";
import { MARKET_ADDRESS, monadTestnet } from "@/chain/monad";
import { listMatches, type MatchMeta } from "./matches";

/* Chain-derived statistics (prd.md §15.4).

   The obvious implementation — scan every BetPlaced since the deploy block —
   is impossible here: the public RPC caps eth_getLogs at a 100-block range,
   blocks are 0.30s, so a day of history is ~2,900 requests. Measured, not
   assumed.

   What works instead:

   1. The match store says which games exist and at what block each opened.
   2. Logs are read only across one game's betting window — ~10 calls — which
      is the one thing logs are actually needed for: *which addresses bet*.
   3. Everything else comes from view calls, which have no range limit, and
      they go out in a single multicall.

   So cost is bounded by the number of games, not by the age of the chain. */

const client = createPublicClient({
  chain: monadTestnet,
  transport: http(),
  batch: { multicall: true },
});

const contract = { address: MARKET_ADDRESS, abi: marketAbi } as const;

const BET_EVENT = parseAbiItem(
  "event BetPlaced(uint256 indexed gameId, address indexed user, uint8 agentId, uint256 amount)",
);

/** The RPC's hard limit. Not a tuning knob — larger ranges are rejected. */
const LOG_CHUNK = 100n;
/** 300s betting window at 0.30s blocks, plus slack. Caps cost per game. */
const MAX_CHUNKS = 12;

export type Bettor = {
  address: `0x${string}`;
  staked: number;
  /** Stake that was on the agent who turned out to be the Imposter. */
  onWinner: number;
  /** Still claimable right now. Goes to zero the moment they claim, so it
      answers "show the button?" and nothing else. */
  payout: number;
  /** What this position was worth, whether or not it has been collected.
      P&L must use this: paying yourself out is not a loss. */
  won: number;
  claimed: boolean;
};

export type GameStat = {
  id: string;
  numericId: string;
  startedAt: number;
  exists: boolean;
  resolved: boolean;
  abandoned: boolean;
  imposterId: number | null;
  totalPool: number;
  pools: number[];
  bettors: Bettor[];
};

/* Only the log scan is cached, and only once betting has closed.

   An earlier version cached the whole GameStat for any resolved game, on the
   reasoning that resolved games never change. They do: `claimed[gameId][user]`
   flips when someone collects, and `payoutOf` reads it. So a claimed payout
   went on being reported as claimable and the Claim button never went away.

   Which addresses bet *is* immutable once the market closes, and it is the
   expensive part — ten getLogs calls. Amounts are re-read every time, in one
   multicall, which costs nothing. */
const bettorCache = new Map<string, `0x${string}`[]>();

export async function gameStat(meta: MatchMeta): Promise<GameStat | null> {
  try {
    const gameId = BigInt(meta.numericId);
    const [game, pools] = await client.multicall({
      contracts: [
        { ...contract, functionName: "games", args: [gameId] },
        { ...contract, functionName: "pools", args: [gameId] },
      ],
      allowFailure: false,
    });

    const [, exists, resolved, abandoned, imposterId, , totalPool] = game;
    if (!exists) return null;

    const stat: GameStat = {
      id: meta.id,
      numericId: meta.numericId,
      startedAt: meta.startedAt,
      exists,
      resolved,
      abandoned,
      // 255 is NO_AGENT — never let an unresolved game read as agent 0.
      imposterId: imposterId === 255 ? null : imposterId,
      totalPool: Number(formatEther(totalPool)),
      pools: (pools as readonly bigint[]).map((p) => Number(formatEther(p))),
      bettors: [],
    };

    if (stat.totalPool > 0 && meta.createdBlock > 0) {
      stat.bettors = await bettorsFor(
        gameId,
        meta.numericId,
        meta.createdBlock,
        stat,
        resolved,
      );
    }

    return stat;
  } catch {
    return null; // one bad game must not empty the whole leaderboard
  }
}

/** Logs answer only "who bet"; the amounts come from view calls, which are
    authoritative even if a log page were missed. */
async function bettorsFor(
  gameId: bigint,
  key: string,
  fromBlock: number,
  game: GameStat,
  closed: boolean,
): Promise<Bettor[]> {
  let list = bettorCache.get(key);

  if (!list) {
    const addresses = new Set<`0x${string}`>();
    let from = BigInt(fromBlock);

    for (let i = 0; i < MAX_CHUNKS; i++) {
      try {
        const logs = await client.getLogs({
          ...contract,
          event: BET_EVENT,
          args: { gameId },
          fromBlock: from,
          toBlock: from + LOG_CHUNK - 1n,
        });
        for (const log of logs) if (log.args.user) addresses.add(log.args.user);
      } catch {
        // A rejected page is not fatal — the view calls below still price
        // whoever we did find, and a missed bettor simply does not appear.
      }
      from += LOG_CHUNK;
    }

    list = [...addresses];
    // Only safe to remember once no further bets can arrive.
    if (closed) bettorCache.set(key, list);
  }

  if (list.length === 0) return [];

  const reads = await client.multicall({
    contracts: list.flatMap((address) => [
      { ...contract, functionName: "stakesOf" as const, args: [gameId, address] },
      { ...contract, functionName: "payoutOf" as const, args: [gameId, address] },
      { ...contract, functionName: "claimed" as const, args: [gameId, address] },
    ]),
  });

  const winPool = game.imposterId === null ? 0 : (game.pools[game.imposterId] ?? 0);

  return list
    .map((address, i) => {
      const stakes = reads[i * 3];
      const payout = reads[i * 3 + 1];
      const claimedRead = reads[i * 3 + 2];
      if (stakes.status !== "success") return null;

      const per = (stakes.result as readonly bigint[]).map((n) => Number(formatEther(n)));
      const staked = per.reduce((a, b) => a + b, 0);
      const onWinner = game.imposterId === null ? 0 : (per[game.imposterId] ?? 0);

      /* Entitlement, mirroring payoutOf but without the claimed check, so the
         figure survives being collected. An abandoned game refunds the stake;
         so does a resolved game nobody picked correctly (prd.md §3). */
      const won = !game.resolved
        ? 0
        : game.abandoned || winPool === 0
          ? staked
          : (game.totalPool * onWinner) / winPool;

      return {
        address,
        staked,
        onWinner,
        payout:
          payout.status === "success" ? Number(formatEther(payout.result as bigint)) : 0,
        won,
        claimed: claimedRead.status === "success" ? Boolean(claimedRead.result) : false,
      };
    })
    .filter((b): b is Bettor => b !== null && b.staked > 0);
}

export type LeaderRow = {
  address: `0x${string}`;
  staked: number;
  returned: number;
  net: number;
  games: number;
  hits: number;
  hitRate: number;
  best: number;
};

export type Stats = {
  games: GameStat[];
  leaders: LeaderRow[];
  totals: { openMarkets: number; staked: number; resolved: number; players: number };
  /** Per agent index: how often they were the Imposter, and how often the
      crowd's money was on them when they were. */
  agents: { index: number; timesImposter: number; caught: number }[];
};

/* A short TTL in front of the whole aggregate. Several surfaces poll this and
   a warm lambda should not re-read the chain for each of them; resolved games
   are already cached forever above, so this only shields the live ones. */
let cache: { at: number; value: Stats } | null = null;
const TTL_MS = 8000;

export async function buildStats(limit = 25): Promise<Stats> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const stats = await compute(limit);
  cache = { at: Date.now(), value: stats };
  return stats;
}

async function compute(limit: number): Promise<Stats> {
  const metas = await listMatches(limit);
  const games = (await Promise.all(metas.map(gameStat))).filter(
    (g): g is GameStat => g !== null,
  );

  const rows = new Map<string, LeaderRow>();
  const agents = Array.from({ length: 6 }, (_, index) => ({
    index,
    timesImposter: 0,
    caught: 0,
  }));

  for (const g of games) {
    if (g.resolved && g.imposterId !== null && !g.abandoned) {
      const a = agents[g.imposterId];
      if (a) {
        a.timesImposter += 1;
        // "Caught" means the crowd had the biggest share of the pool on them.
        const top = g.pools.indexOf(Math.max(...g.pools));
        if (g.totalPool > 0 && top === g.imposterId) a.caught += 1;
      }
    }

    for (const b of g.bettors) {
      const key = b.address.toLowerCase();
      const row = rows.get(key) ?? {
        address: b.address,
        staked: 0,
        returned: 0,
        net: 0,
        games: 0,
        hits: 0,
        hitRate: 0,
        best: 0,
      };
      row.staked += b.staked;
      row.games += 1;
      if (g.resolved) {
        // `won`, never `payout` — payout drops to zero on collection, so using
        // it would mean claiming your winnings lowered your ranking.
        row.returned += b.won;
        if (b.onWinner > 0) row.hits += 1;
        row.best = Math.max(row.best, b.won - b.staked);
      }
      rows.set(key, row);
    }
  }

  const leaders = [...rows.values()]
    .map((r) => ({
      ...r,
      net: r.returned - r.staked,
      hitRate: r.games ? Math.round((r.hits / r.games) * 100) : 0,
    }))
    .sort((a, b) => b.net - a.net || b.staked - a.staked);

  return {
    games,
    leaders,
    totals: {
      openMarkets: games.filter((g) => !g.resolved).length,
      staked: games.reduce((a, g) => a + g.totalPool, 0),
      resolved: games.filter((g) => g.resolved).length,
      players: leaders.length,
    },
    agents,
  };
}
