# Agent Imposter

Six AI agents work in an office. One of them is lying. You can't play — you can only watch, and bet on who it is.

A spectator-first social deduction game where the players are LLMs and the audience is human. Six agents move between rooms, do tasks, and argue in meetings. One is the Imposter. While the match plays out, spectators stake MON on who they think it is, into a parimutuel pool on Monad testnet. The Imposter's identity is committed on-chain *before the first bet is placed*, so the house can't move the answer once money is down.

> **Testnet only.** This app is hard-locked to Monad testnet (chain 10143). Never send real funds to any address here.

---

## Table of contents

- [How a match works](#how-a-match-works)
- [The three architectural bets](#the-three-architectural-bets)
- [Quick start](#quick-start)
- [Contract](#contract)
- [Project layout](#project-layout)
- [Development commands](#development-commands)
- [Environment variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## How a match works

```
POST /api/game
      │
      │  1. The entire match is simulated server-side, start to finish.
      │     Every LLM call happens here — before anyone is watching.
      ▼
  event log  ──────────────────────────────────────────────┐
      │                                                     │
      │  2. Imposter committed on-chain:                    │
      │     keccak256(gameId, imposterId, salt)             │
      ▼                                                     │
  createGame() ───────────────► Monad testnet               │
                                                            │
  3. GET /api/game/[id]/stream                              │
     replays the log on a timer, projecting each            │
     event into a redacted snapshot  ◄─────────────────────┘
      │
      │  Spectators bet() while it plays. ~81s of playback.
      ▼
  4. POST /api/game/[id]/resolve
     reveals imposterId + salt, contract verifies against
     the commitment, winners split the whole pool.
```

**Why the identity stays hidden:** the browser is never sent the event log. It's sent a `Match` snapshot, and `Match` has no field that can hold an imposter id. The redaction is structural, not a filter someone can forget to apply.

---

## The three architectural bets

Everything else in this codebase follows from these three decisions.

### 1. Simulate, then stream

The whole game is generated into an event log *before playback starts*. The frontend is a dumb player walking a finished log on a timer.

This is the load-bearing decision. LLM calls are slow and occasionally fail; a live-inference game means every pause and every timeout happens in front of the audience. Generating up front moves all of that off the critical path — playback is deterministic and can't stall, because the hard work is already done.

### 2. The projection seam

```ts
project(events, upto) → Match
```

A pure fold from the chronological log into the snapshot shape the UI renders. The engine emits events; the UI consumes state; this function is the only thing between them. It's also where redaction lives — see above.

### 3. The chain is a settlement layer, not a dependency

Every on-chain call is best-effort. No private key, flaky RPC, rejected transaction — the game still plays, just without a market. A hard chain dependency would mean a bad RPC could take the whole product down mid-demo.

---

## Quick start

**Requirements:** [Bun](https://bun.sh) 1.4+, an OpenAI API key (optional), a wallet with Monad testnet MON (optional).

```bash
git clone https://github.com/aizen2006/Agent-Imposter.git
cd Agent-Imposter/frontend
bun install
cp .env.local.example .env.local     # then edit it — see below
bun run dev
```

Open <http://localhost:3000> and hit **Start match**.

### It works with nothing configured

Both integrations degrade instead of failing, so you can run the whole thing with an empty `.env.local`:

| Missing | What happens |
|---|---|
| `OPENAI_API_KEY` | Agents fall back to the stub brain — a seeded heuristic. Games still play and still have drama; the dialogue is templated rather than written. |
| `RESOLVER_PK` | No on-chain market. The game runs, the market shows a flat 1-in-6, betting is disabled. |
| Both | Fully offline. Good for working on the UI. |

Verify the engine without any key at all:

```bash
cd frontend
bun src/engine/dev.ts            # print one match as text
bun src/engine/dev.ts --stats 300  # drama statistics over 300 matches
```

---

## Contract

**`ImposterMarket.sol`** — a parimutuel pool with commit–reveal on the outcome.

| | |
|---|---|
| **Address** | [`0xFc7AcE219951bE036ED78C2c8D1B338107AdD7d9`](https://testnet.monadexplorer.com/address/0xFc7AcE219951bE036ED78C2c8D1B338107AdD7d9) |
| **Network** | Monad Testnet — chain ID **10143** |
| **RPC** | `https://testnet-rpc.monad.xyz` |
| **Currency** | MON |
| **Deployed** | block 57865094, tx [`0x6db59a08…`](https://testnet.monadexplorer.com/tx/0x6db59a080b1ec882c1349f7ac26a0e0a85f6e0eb73b334cd166e55139b5c0355) |
| **Compiler** | Solidity 0.8.24, optimizer on, 200 runs |
| **Source** | [`contract/ImposterMarket.sol`](contract/ImposterMarket.sol) |
| **Deploy record** | [`contract/deployed.json`](contract/deployed.json) |

Deployed via Remix. `deployed.json` is the record of truth and includes a `verifiedOnChain` block where the constants were read back after deploy to confirm the deployed bytecode is the post-audit build.

### Interface

```solidity
// Resolver only
function createGame(uint256 gameId, uint64 closeAt, bytes32 commitment) external;
function resolve(uint256 gameId, uint8 imposterId, bytes32 salt) external;
function setResolver(address r) external;

// Anyone
function bet(uint256 gameId, uint8 agentId) external payable;
function claim(uint256 gameId) external;
function abandon(uint256 gameId) external;          // escape hatch, see below

// Views
function pools(uint256 gameId) external view returns (uint256[6] memory);
function payoutOf(uint256 gameId, address user) external view returns (uint256);
function stakesOf(uint256 gameId, address user) external view returns (uint256[6] memory);
function commitmentFor(uint256 gameId, uint8 imposterId, bytes32 salt) external pure returns (bytes32);
```

### How the money works

Parimutuel, not fixed-odds. Everyone's stake goes into one pool; when the Imposter is revealed, everyone who picked correctly splits **the entire pool** in proportion to their stake.

```
payout = totalPool × yourStakeOnWinner / totalStakedOnWinner
```

No house edge, no fee, no counterparty. Odds shown in the UI are derived live from pool ratios, so they move as people bet.

### The safety properties worth knowing

These came out of an audit pass and each one closes a specific hole:

- **Commit–reveal.** `createGame` takes `keccak256(abi.encodePacked(gameId, imposterId, salt))`. `resolve` must produce a preimage matching it, so the outcome is provably fixed before the first bet. The salt is 32 bytes of CSPRNG output — with only six possible imposters, an unsalted commitment is trivially brute-forced.
- **The resolver cannot bet.** `bet()` rejects `msg.sender == resolver`. The one account that knows the answer is barred from trading on it.
- **`abandon()` is permissionless.** If the resolver never reveals, anyone can call it after `RESOLVE_WINDOW` (24h) and everyone withdraws their own stake. A resolver that goes dark can't strand funds.
- **`NO_AGENT = 255`, not 0.** An unresolved game reads as `imposterId == 255`. If the default were `0`, an unresolved game would look like ATLAS did it.
- **Refund on an empty winning pool.** If nobody picked the Imposter, `payoutOf` returns each user their own stake rather than dividing by zero.

### Agent index order is fixed

```
0 ATLAS   1 BYTE   2 CIRCE   3 DELTA   4 ECHO   5 FLINT
```

This is the `agentId` that `bet()` takes on-chain. It's mirrored in `engine/config.ts` and `lib/match.ts`. **Reordering it silently repoints every open bet** — treat it as immutable.

---

## Project layout

```
agent_imposter/
├── contract/
│   ├── ImposterMarket.sol      the market — commit-reveal parimutuel
│   └── deployed.json           deployment record of truth
├── prd.md                      the build spec: rules, staging, decisions
├── design.md                   design system — color, type, motion, anatomy
├── docs/prd-v2-vision.md       the original long-form vision doc
└── frontend/
    └── src/
        ├── engine/             the game — no LLM, no React, no chain
        │   ├── types.ts        GameEvent union, Brain interface
        │   ├── config.ts       rooms, adjacency, roster, tasks
        │   ├── rules.ts        legal moves, kill targets, vote tally
        │   ├── simulate.ts     runGame() → event log
        │   ├── project.ts      ★ the seam: events → redacted Match
        │   ├── rng.ts          seeded mulberry32, reproducible replays
        │   ├── brain-stub.ts   heuristic brain, needs no API key
        │   └── dev.ts          CLI harness + statistics
        ├── agents/             the LLM layer
        │   ├── brain.ts        LangChain + OpenAI, deadline-wrapped
        │   ├── memory.ts       ★ buildView() — what each agent witnessed
        │   ├── personalities.ts
        │   └── leak-check.ts   verifies the hidden-information rule
        ├── chain/
        │   ├── monad.ts        testnet lock, wagmi config, addresses
        │   ├── resolver.ts     server-side signer (createGame / resolve)
        │   ├── useMarket.ts    client hooks (bet / claim / pools)
        │   └── abi.ts
        ├── components/live/    the match UI
        ├── app/api/game/       POST create · GET stream · POST resolve
        └── store/games.ts      in-memory match store
```

The two ★ files are where the interesting invariants live. `project.ts` is what keeps the answer out of the browser; `memory.ts` is what keeps it out of the *other agents*, which is what makes the meetings mean anything.

---

## Development commands

Run from `frontend/`:

```bash
bun run dev                          # dev server
bun run build                        # production build + typecheck
bun run lint                         # eslint
bunx tsc --noEmit                    # typecheck alone

bun src/engine/dev.ts                # play one match, printed as text
bun src/engine/dev.ts 42             # ...with a specific seed (reproducible)
bun src/engine/dev.ts 42 --llm       # ...driven by real models
bun src/engine/dev.ts --stats 300    # kill rate, win rate, event counts

bun src/agents/leak-check.ts 100     # prove no agent sees what it shouldn't
```

`leak-check` needs no API key — it inspects what the engine would put in front of a model, not what a model does with it. If it fails, the arguments in the meeting stop meaning anything because everyone already knows the answer.

### API

| Route | Does |
|---|---|
| `POST /api/game` | Generates a full match, commits the Imposter on-chain, returns its id |
| `GET /api/game/[id]/stream` | SSE — replays the log on a timer as redacted snapshots |
| `POST /api/game/[id]/resolve` | Reveals on-chain. Idempotent — every viewer calls it |

---

## Environment variables

Copy `frontend/.env.local.example` → `frontend/.env.local`. Everything is optional.

```bash
# Drives the agents through LangChain. Without it, the stub brain plays.
OPENAI_API_KEY=sk-...

# Optional model overrides. Actions are a 5-way choice fired 6× in parallel
# every round, so they run small and fast; meeting dialogue is the product.
OPENAI_ACTION_MODEL=gpt-4o-mini
OPENAI_DIALOGUE_MODEL=gpt-4o
LLM_TIMEOUT_MS=8000

NEXT_PUBLIC_CONTRACT_ADDRESS=0xFc7AcE219951bE036ED78C2c8D1B338107AdD7d9

# Private key that signs createGame / resolve. Must be the account the
# contract's `resolver` points at, and it needs testnet MON for gas.
RESOLVER_PK=
```

### About `RESOLVER_PK`

It needs a **private key** — 64 hex characters — not a wallet address (40 hex). An address can't sign anything.

Use a testnet-only account. The guards in `chain/monad.ts` and `chain/resolver.ts` mean this key can't touch mainnet, but the discipline is worth keeping anyway: never fund this account on a real network.

Verify what your key derives to without ever printing the key:

```bash
cd frontend
node -e "const fs=require('fs');const{privateKeyToAccount}=require('viem/accounts');const h=fs.readFileSync('.env.local','utf8').split(/\r?\n/).find(l=>l.startsWith('RESOLVER_PK=')).slice(12).trim();console.log('derives to:',privateKeyToAccount(h.startsWith('0x')?h:'0x'+h).address)"
```

That address must equal the contract's `resolver()`. If it doesn't, call `setResolver(yourAddress)` **from the current resolver account** — only the sitting resolver can hand off the role.

### The testnet lock

Four independent guards, because viem ships `monad` (mainnet, chain **143**) in the same package as `monadTestnet` (**10143**), one autocomplete slip apart:

1. `monad.ts` throws at import if `monadTestnet.id !== 10143`
2. `resolver.ts` asks the RPC what chain it *actually* is before signing anything
3. Every wagmi read and write pins `chainId`, so a wallet on another chain gets `ChainMismatchError` before the popup opens
4. `wagmiConfig` knows exactly one chain

---

## Troubleshooting

**`market: { open: false, reason: "resolver wallet unavailable" }`**
`RESOLVER_PK` is unset or isn't a 64-hex private key. The game plays fine without it — this is the intended degradation, not a crash.

**`resolve failed: not resolver`**
Your key's address isn't the contract's `resolver()`. Verify with the snippet above, then `setResolver` from the *current* resolver.

**`not on Monad testnet`**
The RPC answered with a chain id that isn't 10143. Check your endpoint.

**Transactions fail silently in the browser**
Wrong network. The top bar shows a **Switch to Monad testnet** button — click it.

**Agents sound generic / repetitive**
No `OPENAI_API_KEY`, so the stub brain is playing. That's expected.

**`bet()` reverts with `resolver cannot bet`**
You're connected as the resolver account. Switch to any other wallet — this restriction is deliberate.

---

## Stack

| | |
|---|---|
| Frontend | Next.js 16.3.3 · React 19.2.8 · TypeScript · Tailwind v4 |
| Agents | LangChain TS v1 + OpenAI |
| Chain | wagmi v3 · viem 2.56 · Solidity 0.8.24 |
| Runtime | Bun 1.4 |

Tailwind v4 means design tokens live in `@theme` inside CSS — there's no `tailwind.config.js` and adding one won't do what you expect.

---

## Further reading

- [`prd.md`](prd.md) — the build spec. Locked game rules, the six-stage plan, and the reasoning behind each decision.
- [`design.md`](design.md) — the Modernist design system: color roles, agent hues, type scale, motion.
- [`contract/deployed.json`](contract/deployed.json) — deployment record of truth.
