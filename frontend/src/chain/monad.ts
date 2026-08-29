/* Monad testnet + the deployed ImposterMarket.
   Deployment record of truth: contract/deployed.json
   The wagmi config is added here in Stage 5; this file stays dependency-free until then
   so it compiles today. */

export const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
} as const;

/** Deployed 2026-08-29, block 57865094. */
export const MARKET_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0xFc7AcE219951bE036ED78C2c8D1B338107AdD7d9") as `0x${string}`;

/** Wallet authorized to call createGame / resolve. Currently the deployer.
    Swap via setResolver() if you move signing to a dedicated backend key. */
export const RESOLVER_ADDRESS =
  "0x462dD91a5d71e738411f0d021F12aa94052e19E9" as `0x${string}`;

/** Matches AGENT_COUNT on-chain. Agent index order is fixed in lib/match.ts
    (ATLAS 0 … FLINT 5) and must never be reordered — it is what bet() takes. */
export const AGENT_COUNT = 6;
