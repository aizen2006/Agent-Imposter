"use client";

import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { marketAbi } from "./abi";
import { AGENT_COUNT, MARKET_ADDRESS, TESTNET_ID, monadTestnet } from "./monad";

/* Thin hooks over ImposterMarket. Deliberately thin — the interesting logic is
   all on-chain, and the UI was built before any of this existed.

   Every call pins chainId. Without it wagmi uses whatever chain the wallet
   happens to be on, so a user sitting on mainnet would send real funds to an
   address where nothing is deployed. With it, wagmi throws ChainMismatchError
   before the wallet ever opens. */

const contract = { address: MARKET_ADDRESS, abi: marketAbi, chainId: TESTNET_ID } as const;

export function useWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  return {
    address,
    isConnected,
    /** Betting silently fails on the wrong network, so surface it. */
    wrongChain: isConnected && chainId !== monadTestnet.id,
    connecting: isPending,
    switching,
    /** Prompts the wallet to move to Monad testnet, adding it if unknown. */
    switchToTestnet: () => switchChain({ chainId: TESTNET_ID }),
    connect: () => connect({ connector: injected(), chainId: TESTNET_ID }),
    disconnect,
    short: address ? `${address.slice(0, 4)}…${address.slice(-3)}` : undefined,
  };
}

/** Per-agent MON staked, indexed 0–5, plus the total. Polls so the market
    visibly moves while a game is running. */
export function usePools(gameId?: bigint) {
  const { data, refetch, isLoading } = useReadContract({
    ...contract,
    functionName: "pools",
    args: gameId !== undefined ? [gameId] : undefined,
    query: {
      enabled: gameId !== undefined,
      refetchInterval: 5000,
    },
  });

  const raw = (data ?? new Array(AGENT_COUNT).fill(0n)) as readonly bigint[];
  const pools = raw.map((p) => Number(formatEther(p)));

  return {
    pools,
    total: pools.reduce((a, b) => a + b, 0),
    isLoading,
    refetch,
  };
}

/** `games()` returns a positional 7-tuple, not an object. */
export function useGameState(gameId?: bigint) {
  const { data } = useReadContract({
    ...contract,
    functionName: "games",
    args: gameId !== undefined ? [gameId] : undefined,
    query: { enabled: gameId !== undefined, refetchInterval: 5000 },
  });

  if (!data) return undefined;
  const [closeAt, exists, resolved, abandoned, imposterId, , totalPool] = data;

  return {
    closeAt: Number(closeAt),
    exists,
    resolved,
    abandoned,
    // 255 (NO_AGENT) until resolution — never treat the default as agent 0.
    imposterId: imposterId === 255 ? null : imposterId,
    totalPool: Number(formatEther(totalPool)),
  };
}

export function usePayout(gameId?: bigint, address?: `0x${string}`) {
  const { data, refetch } = useReadContract({
    ...contract,
    functionName: "payoutOf",
    args: gameId !== undefined && address ? [gameId, address] : undefined,
    query: { enabled: gameId !== undefined && Boolean(address) },
  });
  return { payout: data ? Number(formatEther(data)) : 0, refetch };
}

/** Place a bet, then a claim, sharing one write slot. */
export function useMarketWrite() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: TESTNET_ID });

  return {
    hash,
    error,
    reset,
    isPending,
    isConfirming: receipt.isLoading,
    isConfirmed: receipt.isSuccess,

    bet: (gameId: bigint, agentIndex: number, mon: number) =>
      writeContract({
        ...contract,
        functionName: "bet",
        args: [gameId, agentIndex],
        value: parseEther(String(mon)),
      }),

    claim: (gameId: bigint) =>
      writeContract({ ...contract, functionName: "claim", args: [gameId] }),
  };
}
