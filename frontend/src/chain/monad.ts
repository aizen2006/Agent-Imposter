import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { monadTestnet } from "viem/chains";

/* Monad testnet + the deployed ImposterMarket.
   Deployment record of truth: contract/deployed.json

   TESTNET ONLY. viem also exports `monad` — mainnet, chain 143 — one import
   line away from this one, and the resolver holds a key that signs without
   asking anyone. So the id is asserted here rather than assumed, and every
   read, write and transaction pins it explicitly. Nothing in this app may
   touch a chain that is not 10143. */

export const TESTNET_ID = 10143 as const;

if (monadTestnet.id !== TESTNET_ID) {
  // viem renamed or repointed the export. Fail at import, not at signing time.
  throw new Error(
    `[chain] expected Monad testnet (${TESTNET_ID}) but viem's monadTestnet is ${monadTestnet.id}`,
  );
}

export { monadTestnet };

/** Throws unless `id` is Monad testnet. Used at every boundary where a chain
    id arrives from outside — a wallet, an RPC, an env var. */
export function assertTestnet(id: number | undefined, where: string): void {
  if (id !== TESTNET_ID) {
    throw new Error(
      `[chain] ${where} is on chain ${id ?? "unknown"}, refusing — this app is Monad testnet (${TESTNET_ID}) only`,
    );
  }
}

export const wagmiConfig = createConfig({
  // One chain, deliberately. wagmi will not send to a chain it does not know.
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(),
  },
  ssr: true,
});

/** Deployed 2026-08-29, block 57865094. */
export const MARKET_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0xFc7AcE219951bE036ED78C2c8D1B338107AdD7d9") as `0x${string}`;

/** Wallet authorised to call createGame / resolve. Currently the deployer.
    Barred from betting by the contract, so it can never trade on what it knows. */
export const RESOLVER_ADDRESS =
  "0x462dD91a5d71e738411f0d021F12aa94052e19E9" as `0x${string}`;

/** Matches AGENT_COUNT on-chain. Agent index order is fixed in lib/match.ts
    (ATLAS 0 … FLINT 5) and must never be reordered — it is what bet() takes. */
export const AGENT_COUNT = 6;

export const explorerTx = (hash: string) =>
  `${monadTestnet.blockExplorers?.default.url}/tx/${hash}`;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
