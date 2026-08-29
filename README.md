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
- [Deploying](#deploying)
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

## Pages

| | |
|---|---|
| `/` | Home — hero, how it works, live markets, the crew's record, recent verdicts |
| `/lobby` | Every match on the floor. Join a running one and it picks up where it is |
| `/leaderboard` | Net P&L across settled markets, with hit rate beside it |
| `/my-bets` | Your positions, and anything the contract still owes you |
| `/game/[id]` | A match, live or joined late |
| `/game/golden` | The recorded fallback — no network, no model, no chain |

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

### The recorded match

<http://localhost:3000/game/golden> replays a pre-generated match entirely in the browser — no
API call, no model, no chain. It exists as a demo safety net for when the wifi dies, and it's
the fastest way to see a finished game without spending tokens.

```bash
bun --env-file=.env.local src/engine/golden.ts 10 --llm   # re-bake it
```

That scores a batch of candidate matches for how well they demo — kills, a discovered body,
wrongful ejections, going the full three rounds — and writes the best to
`public/golden-game.json`. It replays through the same `project()` and the same timing table as
the live path, so it can't drift from the real thing. Betting is disabled on it, since there's
no on-chain market behind a recording.

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
        │   ├── timing.ts       playback pacing, shared by live + recorded
        │   ├── golden.ts       bakes public/golden-game.json
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
        │   ├── ticket.ts       ★ sealed reveal — how resolution survives serverless
        │   ├── useMarket.ts    client hooks (bet / claim / pools)
        │   └── abi.ts
        ├── components/live/
        │   ├── Replay.tsx      the player — one for live and recorded alike
        │   ├── LiveGame.tsx    live match, fed from the handoff
        │   ├── GoldenGame.tsx  the recorded fallback
        │   └── …               the match UI
        ├── lib/handoff.ts      carries a match from lobby to match page
        ├── app/api/game/       POST create · POST resolve
        └── store/games.ts      match generation (no store — see Deploying)
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

bun --env-file=.env.local src/engine/golden.ts 10 --llm   # re-bake the recorded match
```

`leak-check` needs no API key — it inspects what the engine would put in front of a model, not what a model does with it. If it fails, the arguments in the meeting stop meaning anything because everyone already knows the answer.

### API

| Route | Does |
|---|---|
| `POST /api/game` | Generates a full match, commits the Imposter on-chain, publishes it, returns every redacted frame plus a sealed reveal ticket |
| `GET /api/match/[id]` | Serves a shared match to anyone who did not generate it |
| `POST /api/game/resolve` | Reveals on-chain from that ticket. Idempotent, and refuses to fire before the match could have finished |
| `GET /api/stats` | Chain-derived aggregate behind the home page, lobby and leaderboard |

Two routes, no state between them. See [Deploying](#deploying).

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

## Deploying

It runs on Vercel with no configuration, but two things about the architecture are worth
knowing because they are what makes that true.

**Nothing is stored between requests.** `POST /api/game` generates the match, projects it into
redacted frames, and returns all of them in one response. The browser replays them locally. An
earlier version held games in a module-level `Map` and streamed them over SSE; on Vercel that
failed immediately, because the lambda that generated a match is not the lambda asked to stream
it — every playback 404'd right after creation. The SSE stream had a second problem too: ~80s of
playback outlives what a serverless function is allowed to run.

**Matches are shared through Blob storage.** `POST /api/game` publishes the frames so anyone can
watch, and a late joiner seeks to wherever the match has got to rather than restarting it. This
is what makes the parimutuel pool mean anything — before it, every viewer generated a private
match and each pool had exactly one bettor in it. Locally, with no Blob token, matches fall back
to a directory in the OS temp dir so the whole thing is developable without provisioning
anything; on Vercel the token decides, because each lambda has its own `/tmp`.

**The reveal travels as a sealed ticket.** Resolution needs the imposter and the salt, which
cannot go to the browser in the clear. So the server encrypts them (AES-256-GCM, key derived
from `RESOLVER_PK`), the browser carries the ciphertext through playback, and hands it back at
the end. Opaque to the client, and a tampered ticket fails authentication — and would still have
to satisfy the on-chain commitment. The ticket also carries a `revealAt` timestamp *inside* the
ciphertext, so publishing it alongside the frames cannot be used to end a match early and
hard-close betting.

Set the same environment variables in the Vercel dashboard as in `.env.local`. Notes:

| | |
|---|---|
| **Root directory** | `frontend` |
| **`maxDuration`** | 60s, set in the create route. Generation takes ~23s with real models, ~1s with the stub. 60 is the Hobby ceiling; Pro allows 300 |
| **Response size** | ~330 KB raw, ~4 KB after Vercel's edge compression. Well under the 4.5 MB function limit |
| **`RESOLVER_PK`** | Without it there is no market *and* no reveal ticket — the game plays off-chain |
| **`BLOB_READ_WRITE_TOKEN`** | Create a Blob store in the Vercel dashboard. Without it matches are not shared: the lobby is empty and each match plays only in the tab that made it |

A match lives in the tab that asked for it, so a `/game/[id]` link opened elsewhere shows "that
match isn't in this tab" rather than a broken player. Sharing a running match is not a feature
this build has.

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

**Lobby and leaderboard are empty**
No `BLOB_READ_WRITE_TOKEN`, so matches aren't being shared and there is nothing to list. The
leaderboard additionally needs real bets — it ranks wallets, so it stays empty until someone
stakes.

**"No such match"**
Matches are kept for a day and then swept. If it happens right after creating one, storage is
off — see above.

**Deployed build shows the match ending immediately**
That was the pre-serverless architecture and is fixed. If you see it again, you're on an old
deployment — the current build has no `/api/game/[id]/stream` route at all.

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
