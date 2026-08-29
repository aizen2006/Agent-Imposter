/* ImposterMarket ABI — pasted from Remix after deploying contract/ImposterMarket.sol.
   `as const` is load-bearing: it is what gives wagmi/viem their argument and return
   type inference. Without it every hook degrades to `any`. */

export const marketAbi = [
  {
    inputs: [{ internalType: "address", name: "_resolver", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },

  // ── writes ──────────────────────────────────────────────────────────────
  {
    inputs: [
      { internalType: "uint256", name: "gameId", type: "uint256" },
      { internalType: "uint64", name: "closeAt", type: "uint64" },
      { internalType: "bytes32", name: "commitment", type: "bytes32" },
    ],
    name: "createGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "gameId", type: "uint256" },
      { internalType: "uint8", name: "agentId", type: "uint8" },
    ],
    name: "bet",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "gameId", type: "uint256" },
      { internalType: "uint8", name: "imposterId", type: "uint8" },
      { internalType: "bytes32", name: "salt", type: "bytes32" },
    ],
    name: "resolve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "gameId", type: "uint256" }],
    name: "abandon",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "gameId", type: "uint256" }],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "r", type: "address" }],
    name: "setResolver",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ── views ───────────────────────────────────────────────────────────────
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "games",
    outputs: [
      { internalType: "uint64", name: "closeAt", type: "uint64" },
      { internalType: "bool", name: "exists", type: "bool" },
      { internalType: "bool", name: "resolved", type: "bool" },
      { internalType: "bool", name: "abandoned", type: "bool" },
      { internalType: "uint8", name: "imposterId", type: "uint8" },
      { internalType: "bytes32", name: "commitment", type: "bytes32" },
      { internalType: "uint256", name: "totalPool", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "gameId", type: "uint256" }],
    name: "pools",
    outputs: [{ internalType: "uint256[6]", name: "", type: "uint256[6]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "gameId", type: "uint256" },
      { internalType: "address", name: "user", type: "address" },
    ],
    name: "stakesOf",
    outputs: [{ internalType: "uint256[6]", name: "", type: "uint256[6]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "gameId", type: "uint256" },
      { internalType: "address", name: "user", type: "address" },
    ],
    name: "payoutOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "claimed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "gameId", type: "uint256" },
      { internalType: "uint8", name: "imposterId", type: "uint8" },
      { internalType: "bytes32", name: "salt", type: "bytes32" },
    ],
    name: "commitmentFor",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "resolver",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "AGENT_COUNT",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "NO_AGENT",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "RESOLVE_WINDOW",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },

  // ── events ──────────────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: false, internalType: "uint64", name: "closeAt", type: "uint64" },
      { indexed: false, internalType: "bytes32", name: "commitment", type: "bytes32" },
    ],
    name: "GameCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint8", name: "agentId", type: "uint8" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "BetPlaced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: false, internalType: "uint8", name: "imposterId", type: "uint8" },
    ],
    name: "GameResolved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "uint256", name: "gameId", type: "uint256" }],
    name: "GameAbandoned",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "gameId", type: "uint256" },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "Claimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
    ],
    name: "ResolverChanged",
    type: "event",
  },
] as const;
