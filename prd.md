# AGENT IMPOSTER — PRD v3

## 6-Hour Hackathon Build Spec

> **Six AI agents. One is the Imposter. Watch the lies. Bet your conviction.**

**This document is a build spec, not a vision doc.** Every open question is answered, every
feature is either in or cut, and the hour-by-hour plan below is the schedule. The full product
vision lives in [docs/prd-v2-vision.md](docs/prd-v2-vision.md) — read that for the *why*, read
this for the *what to type*.

| | |
|---|---|
| **Build budget** | 6 hours, solo |
| **Chain** | Monad testnet |
| **Contract deploy** | Remix (browser) — no Foundry |
| **Agents** | LangChain TS + OpenAI (`gpt-4o-mini` actions, `gpt-4o` dialogue) |
| **Stack** | Next.js 16 + React 19 + TypeScript + Tailwind v4 + wagmi/viem |
| **Game length** | ~81s playback measured, 3 rounds |

---

# 1. Product in Five Lines

Six AI agents work a hackathon office. One is secretly the Imposter. The Imposter fakes tasks,
sabotages systems, and eliminates agents when caught alone with them. The crew investigates,
argues, and votes. Humans never control anything — they watch the simulation and stake MON on
who they think the traitor is, and a Monad contract settles the pool at the reveal.

**Core loop:** Move → Work → Sabotage → Discover → Debate → Bet → Vote → Reveal → Settle

**North star:** after one game, does someone say *"run another one"*?

---

# 2. The Three Architectural Bets

Everything in this spec follows from these. Do not relitigate them mid-build.

## 2.1 Simulate-then-Stream

**Do not build a live real-time engine.** When someone clicks START, generate the *entire* game
server-side into an event log (~60–90s of LLM calls), then stream that log to the browser on a
timer as though it were happening live.

Why this is the decision that makes 6 hours possible:

- The demo cannot stall on LLM latency, a rate limit, or a bad JSON parse — all of that happens
  before the first frame renders.
- The frontend becomes a dumb playback player. No state reconciliation, no optimistic updates,
  no partial-round rendering.
- Betting runs against a deterministic timeline, so "market closes at the final meeting" is a
  timestamp, not a race condition.
- You can cache one good game to disk and demo with the wifi off.

The agents are still genuinely autonomous — they made real decisions under real hidden
information. You are only decoupling *generation* from *presentation*. Nobody watching can tell,
and it removes the top three ways a live AI demo dies on stage.

## 2.2 One Next.js app, no separate backend

The engine lives in `src/engine/` and is called from route handlers. One process, one deploy, no
CORS, no ports, no service discovery. Saves ~45 minutes of pure plumbing.

## 2.3 No database — and, after deploying, no server state either

The original plan was a module-level `Map<string, Game>` in `src/store/games.ts`. Games are
ephemeral, and a DB buys you nothing in six hours while costing schema, migrations and a
connection string.

**That was right locally and wrong on Vercel.** Each request there can land on a different
lambda, so the instance that generated a match was not the instance asked to stream it: every
playback 404'd and the UI showed "that match is gone" immediately after creating one. The SSE
stream had a second, independent problem — it runs ~80s, longer than a function is allowed to
live.

Both problems were the same mistake: keeping state between requests on a platform that does not
have any. The fix removes the need rather than adding a store.

- `POST /api/game` projects the finished match into its redacted frames and returns **all of
  them at once** — ~330 KB raw, ~4 KB after edge compression, cheaper than the stream it
  replaces. The browser replays them on the same timing table.
- The reveal travels as a **sealed ticket** (`src/chain/ticket.ts`): the game id, imposter and
  salt encrypted with AES-256-GCM under a key derived from `RESOLVER_PK`. The browser carries
  it through playback and hands it back to `POST /api/game/resolve`. It is ciphertext the whole
  way, so §6.3 still holds, and a forged ticket fails authentication — and would still have to
  satisfy the on-chain commitment.
- `src/store/games.ts` keeps no map at all now; it only generates.

Simulate-then-stream (§2.1) is untouched. Only the transport moved: from a held-open connection
to one response the client plays back locally, which is what the golden game already did.

---

# 3. Locked Rules

These were open in v2. They are now decided.

| Question | Decision | Rationale |
|---|---|---|
| Nobody bet on the real Imposter | **Refund everyone pro-rata** | 6 lines of Solidity; kills the worst demo outcome (money vanishes) |
| Kill cooldown | **Max 1 per round, none in Round 1** | Round-1 kills land before the audience knows anyone's name — it kills the betting hook |
| Kill legality | **Imposter + target must be the only two ALIVE agents in the room** | Makes the map matter, prevents absurd kills in a crowd, generates a real suspect list |
| Tie vote | **No elimination** | Easiest rule to explain to an audience |
| Imposter voted out early | Game resolves immediately; market closes at that instant | Rare, and a legitimately great story |
| Do tasks gate a win? | **No — tasks are evidence generation only** | A task-completion win condition is a second system you do not have time for |
| Market close | **Start of the Round 3 meeting**, or resolution, whichever is first | One condition, one countdown |
| Protocol fee | **Zero** | Nothing to explain, nothing to debug |
| Crew win | Imposter is voted out | |
| Imposter win | Imposter survives Round 3 | |

## 3.1 Final action sets

Five verbs each. This is enough to produce drama.

- **Crew:** `MOVE` · `TASK` · `WAIT`
- **Imposter:** `MOVE` · `FAKE_TASK` · `SABOTAGE` · `KILL` · `WAIT`

## 3.2 Rooms and adjacency

Six rooms. Adjacency is a hand-written graph — no pathfinding. Agents move one room per action.

> **Names superseded — see §11.7.** The shipped UI uses Standup Room · Server Closet · Kitchen ·
> Whiteboard · Pods · Demo Stage. Keep the graph shape below, rename the nodes.

```
MAIN_HALL     ↔ DEV_ROOM, SERVER_ROOM, PANTRY, MEETING_ROOM
DEV_ROOM      ↔ MAIN_HALL, SERVER_ROOM
SERVER_ROOM   ↔ MAIN_HALL, DEV_ROOM, SECURITY_ROOM
SECURITY_ROOM ↔ SERVER_ROOM, MAIN_HALL
PANTRY        ↔ MAIN_HALL
MEETING_ROOM  ↔ MAIN_HALL       (engine teleports everyone in for meetings)
```

## 3.3 Forced drama schedule

Do not leave the story to chance. The engine *requires* these beats:

- **Round 1** — sabotage fires at the end of the action phase; no kill permitted
- **Round 2** — Imposter must attempt a kill if any legal target exists
- **Round 3** — Imposter kills if legal, otherwise plays the meeting

If the LLM Imposter declines a legal kill in Round 2, **the engine overrides and executes it**.
The audience needs a body.

---

# 4. Cut List

Deleted from v2. If you find yourself building one of these, stop.

`FRAME` · `INVESTIGATE` · `FOLLOW` · `REPORT` · modeled suspicion scores · 7-attribute trait
vectors (fold personality into one prompt string) · multi-pass meeting turn-taking · SQLite /
Postgres · separate backend service · the 5-scenario system (ship **one**: Server Sabotage) ·
Best Detective in the post-game · Foundry · sound.

---

# 5. Directory Structure

```
agent_imposter/
├── prd.md                             # this file
├── docs/
│   └── prd-v2-vision.md               # the original product vision
│
├── contract/                          # a record, not a build target
│   ├── ImposterMarket.sol             # copy of what you pasted into Remix
│   └── deployed.json                  # { address, chainId, deployedAt }
│
└── frontend/                          # Next.js 15 — UI *and* engine
    ├── .env.local                     # ANTHROPIC_API_KEY, RESOLVER_PK, NEXT_PUBLIC_CONTRACT
    ├── package.json
    ├── public/
    │   └── golden-game.json           # the demo safety net
    └── src/
        ├── app/
        │   ├── page.tsx                       # lobby: [ START NEW GAME ]
        │   ├── game/[id]/page.tsx              # the whole game view
        │   └── api/game/
        │       ├── route.ts                    # POST → simulate full game, return id
        │       └── [id]/
        │           ├── stream/route.ts         # GET SSE → replays event log on a timer
        │           └── resolve/route.ts        # POST → resolver tx to Monad
        │
        ├── engine/
        │   ├── types.ts               # Game, Agent, GameEvent, Action    ← write first
        │   ├── config.ts              # ROOMS, ADJACENCY, TASKS, AGENTS
        │   ├── rules.ts               # legalActions() + validate()
        │   ├── brain-stub.ts          # random legal action — never deleted
        │   ├── simulate.ts            # runGame() → GameEvent[]           ← the heart
        │   └── project.ts             # project(events, upto) → Match     ← the seam (§7.2)
        │
        ├── agents/
        │   ├── personalities.ts       # 6 prompt profiles, one string each
        │   ├── brain.ts               # decide() + speak() — falls back to the stub
        │   └── memory.ts              # buildView(agent, events)
        │
        ├── components/                # ✅ BUILT — documented in design.md
        │   ├── Crewmate.tsx           # Crewmate / CrewmateGhost / CrewBlob
        │   └── live/                  # TopBar, MatchBar, OfficeMap, CrewStrip, Market,
        │                              # Chatter, BetTicket, RecapStrip, LiveMatch
        │
        ├── chain/
        │   ├── abi.ts                 # pasted from Remix, `as const`
        │   ├── monad.ts               # monad testnet chain def + wagmi config
        │   └── useMarket.ts           # pools / bet / claim hooks
        │
        ├── store/games.ts             # Map<string, Game> — module singleton
        └── lib/match.ts               # ✅ BUILT — the UI's data contract
```

**Two files carry the project:** `engine/simulate.ts` and `agents/brain.ts`. Everything else is
glue or pixels. If you fall behind, protect the time on those two.

---

# 6. Data Model

Write `types.ts` first. Everything else conforms to it.

```ts
export type RoomId =
  | "MAIN_HALL" | "DEV_ROOM" | "SERVER_ROOM"
  | "SECURITY_ROOM" | "PANTRY" | "MEETING_ROOM";

export type Role = "CREW" | "IMPOSTER";

export type ActionType =
  | "MOVE" | "TASK" | "WAIT"
  | "FAKE_TASK" | "SABOTAGE" | "KILL";

export interface Agent {
  id: number;             // 0..5 — same index the contract uses
  name: string;           // "Sherlock"
  emoji: string;          // "🕵️"
  role: Role;             // SERVER ONLY. Never crosses the wire.
  room: RoomId;
  alive: boolean;
}

export type GameEvent =
  | { t: "GAME_STARTED";   round: 0 }
  | { t: "AGENT_MOVED";    round: number; agentId: number; to: RoomId }
  | { t: "TASK_DONE";      round: number; agentId: number; room: RoomId; task: string }
  | { t: "SABOTAGE";       round: number; room: RoomId; what: string }
  | { t: "KILL";           round: number; victimId: number; room: RoomId }   // killer hidden
  | { t: "BODY_FOUND";     round: number; victimId: number; room: RoomId; finderId: number }
  | { t: "MEETING_START";  round: number }
  | { t: "SAID";           round: number; agentId: number; text: string }
  | { t: "VOTE";           round: number; agentId: number; targetId: number }
  | { t: "ELIMINATED";     round: number; agentId: number; role: Role }      // role revealed
  | { t: "NO_ELIMINATION"; round: number }
  | { t: "RESOLVED";       round: number; imposterId: number; crewWon: boolean };

export interface Game {
  id: string;
  numericId: bigint;      // what the contract sees
  agents: Agent[];
  events: GameEvent[];    // the ONLY state that matters
  imposterId: number;     // SERVER ONLY
  salt: `0x${string}`;    // SERVER ONLY — commit/reveal
  closeAt: number;        // unix seconds, betting deadline
  createdAt: number;
}
```

## 6.1 The event log is the only state

Everything the UI renders, everything an agent knows, and the entire replay derive from
`GameEvent[]`. There is no second source of truth. This is what keeps the codebase small enough
to finish.

## 6.2 Information model — one function

`buildView(agent, events)` filters the log down to what *this* agent could have witnessed. It is
the entirety of the hidden-information system and the only place a role can leak.

```
An agent sees an event if:
  - it is MEETING_START / SAID / VOTE / ELIMINATED / SABOTAGE   (public)
  - OR it happened in the room the agent was in at that time     (witnessed)
Plus, if agent.role === "IMPOSTER": their own KILL events.
KILL events for everyone else render as "X is missing" with no killer.
```

Roughly 20 lines. Write it carefully — it is the rule that makes the game a *deduction* game
rather than a chat log.

## 6.3 Redaction

**`engine/project.ts` is the single choke point between server and browser.** A `Game` is never
serialized; only the `Match` that `project()` returns crosses the wire, and `Match` has no field
to put `imposterId` or `salt` in.

That is the whole defence, and it works because of a structural property rather than a
discipline: the projection's output type simply cannot express the secret. Before folding a
`RESOLVED` event, no agent in the output carries a role.

Two rules follow:

- Never add `role`, `imposterId` or `salt` to the `Match` type in `lib/match.ts`. Reveal state
  arrives as a `RESOLVED` event like everything else.
- Never send raw `GameEvent[]` to the client either — the SSE stream emits projected snapshots
  (or public events only). A `KILL` event names its victim, never its killer, but the raw log is
  still server-shaped data.

If `imposterId` reaches the browser before the reveal, the product is broken — someone will open
devtools on stage. Grep for it in `src/app` and `src/components` before demoing.

---

# 7. The Simulation

`runGame()` is a plain async function. Pseudocode, in order:

```
assign roles (random imposter), random starting rooms
emit GAME_STARTED

for round in 1..3:
    ── ACTION PHASE ──
    for each alive agent, IN PARALLEL:
        view    = buildView(agent, events)
        options = legalActions(agent, state, round)
        action  = await decide(agent, view, options)     // LLM, or stub on failure
        validate + apply  →  emit events

    apply forced drama schedule (§3.3)
    if a body is in a room with a living agent → emit BODY_FOUND

    ── MEETING PHASE ──
    emit MEETING_START
    for each alive agent, SEQUENTIALLY:                  // each sees prior statements
        text = await speak(agent, view, transcriptSoFar)
        emit SAID

    for each alive agent, IN PARALLEL:
        emit VOTE

    tally → highest unique wins; tie = NO_ELIMINATION
    on elimination: emit ELIMINATED with role revealed
    if eliminated agent was IMPOSTER → break

emit RESOLVED
```

**Parallel where possible, sequential only for the meeting.** Actions have no ordering
dependency, so `Promise.all` all six. Meeting statements *do* — Chaos saying "that is not what I
saw" only works if he read what Politician just said.

Expected wall time: ~15–25s per round, 60–90s total.

## 7.1 Playback timing

The SSE route walks the event log and emits on a schedule so the game reads as live:

| Event | Delay after previous |
|---|---|
| `AGENT_MOVED` | 600 ms |
| `TASK_DONE` / `SABOTAGE` | 900 ms |
| `KILL` / `BODY_FOUND` | 1800 ms — let it land |
| `SAID` | 1400 ms |
| `VOTE` | 400 ms |
| `ELIMINATED` | 2500 ms — the reveal beat |

Total lands near 150 seconds. Tune these numbers last, when you can watch a real game.

## 7.1b Three rules the spec did not predict

Found by running 300 games against the stub brain. Each one was measured, not
guessed, and each is load-bearing — remove any of them and the game degrades in a way
that is invisible in a single playthrough.

**Disperse after every meeting.** Meetings pull all survivors into one room. If the next
round starts from there they never separate, and "alone together" — the only condition
under which a kill is legal — effectively never occurs. *Measured: 74% of games contained
no kill at all.* Survivors now scatter to distinct rooms at the top of each round.

**The engine walks a passive Imposter into the opportunity.** §3.3 says the engine
overrides an Imposter that declines a legal kill. That is not enough: a wandering Imposter
never *creates* a legal kill in the first place. `forceKill` now relocates it to an adjacent
room holding exactly one crew member, then kills. The relocation emits an ordinary
`AGENT_MOVED`, so it is public evidence like any other move — the engine manufactures the
opportunity, never a kill that breaks the alone-together rule. *Zero-kill games: 74% → 5.3%,
the remainder being the crew legitimately ejecting the Imposter in round 1.*

**The killer can never find its own victim.** A kill requires isolation, so immediately
afterwards the killer is the only living agent in the room — making it the finder every
single time. `finderId` would be a perfect tell and an LLM crew would solve every game on
the first body. `bodyFinder` now excludes the killer. That alone left *86% of kills
undiscovered*, so a roll call at the top of each meeting accounts for anyone who did not
turn up, wherever they were left. Bodies found: 100%, self-reports: 0.

## 7.2 Projection — events to screen

The engine emits a **chronological log**. The UI renders a **snapshot**: which rooms hold whom,
what the market shares are, which chat lines exist so far. Those are different shapes, and
something has to convert one into the other.

```ts
// engine/project.ts
export function project(events: GameEvent[], upto: number): Match
```

A pure fold over the first `upto` events producing the `Match` object that
[frontend/src/lib/match.ts](frontend/src/lib/match.ts) already defines and every component
already consumes. It is the single seam between engine and UI.

Getting this right buys three things at once:

- **Playback is just an index.** The SSE stream advances `upto`; the UI re-projects. No
  incremental state patching, no ordering bugs.
- **Scrubbing and replay come free.** "Watch the replay" on the recap strip is
  `project(events, n)` for a smaller `n`.
- **`golden-game.json` is just an event array.** The demo fallback and the live path run the
  identical code.

Build it against the stub-brain log in Stage 2 before any LLM exists — it is pure, so it is the
one part of this system that is genuinely easy to check.

> **The redaction rule lives here.** `project()` runs on the server and must never write
> `imposterId` into its output until it has folded a `RESOLVED` event. Everything the design
> shows — the accused ring, the flagged crew pill, market shares — derives from public events
> only. This function is the choke point §6.3 describes; there is no second one.

---

# 8. The Agent Brain

Two call sites only: `decide()` for actions, `speak()` for meeting statements.

## 8.1 Structured output

```ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Decision = z.object({
  action: z.enum(["MOVE","TASK","WAIT","FAKE_TASK","SABOTAGE","KILL"]),
  target: z.string().nullable(),   // room id or agent name — engine resolves + validates
  say:    z.string().max(140),     // public line; may be a lie
});

const res = await client.messages.parse({
  model: "claude-opus-5",
  max_tokens: 1024,
  output_config: {
    format: zodOutputFormat(Decision),
    effort: "low",                 // 5-way choice — low effort keeps generation under 90s
  },
  system: personality(agent) + RULES,
  messages: [{ role: "user", content: renderView(view, options) }],
});
```

**Effort is the latency lever.** Use `low` for action selection — it is a five-way choice and the
reasoning does not show. Use the default (`high`) for `speak()`, where the writing quality *is*
the product. That split is worth ~40 seconds of generation time.

## 8.2 The LLM never mutates state

The model *requests*; the engine *adjudicates*. `decide()` returns an intent, `rules.ts`
validates it against the real board, and only the engine emits events. If the model asks to kill
someone two rooms away, the engine silently downgrades to `WAIT`. This is the hard separation
that keeps the simulation coherent.

## 8.3 Failure is not allowed to stop the game

```
try   → LLM call with an 8s timeout
catch → retry once
catch → stubDecide()   // random legal action, weighted toward MOVE
```

`stubDecide()` is written in Hour 1 and never deleted. It is both the development harness and
the production fallback.

## 8.4 Personalities

Six prompt strings, ~40 words each. Not different models, not trait vectors — one paragraph of
voice each.

🕵️ **Sherlock** analytical, cites evidence · 🤡 **Chaos** provocative, unserious, often right by
accident · 🎩 **Politician** evasive, reframes every accusation · 🤓 **Hacker** technical,
paranoid, precise about timestamps · 🗿 **Uncle** blunt, short sentences, deeply suspicious ·
🤑 **Degen** overconfident, commits hard to bad reads

The Imposter gets an appended paragraph: they know their role, they know deception is the goal,
and they must never state it.

---

# 9. Smart Contract

Parimutuel pool, four functions, deployed from **Remix**. No Foundry, no imports, no
dependencies — it compiles instantly in the browser.

## 9.1 Commit–reveal

One addition beyond v2. The backend simulates the whole game *before* betting opens, so the
resolver knows the answer the entire time. A judge will ask about this. Committing
`keccak256(imposterId, salt)` at `createGame` and verifying it at `resolve` proves the outcome
was fixed before a single MON was staked. Three lines, and it is the strongest crypto detail in
the project.

## 9.2 ImposterMarket.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ImposterMarket — Parimutuel prediction market for Agent Imposter on Monad
/// @notice Bet MON on which of 6 agents is the hidden Imposter. Winners split the pool.
/// @dev The imposter is committed at createGame and verified at resolve, so the outcome
///      is provably fixed before any stake is placed. If the resolver never returns,
///      `abandon` opens the game for refunds without anyone's permission.
contract ImposterMarket {
    uint8 public constant AGENT_COUNT = 6;

    /// @notice Sentinel for "no imposter revealed yet". Never a valid agent index,
    ///         so a caller reading `games(id)` before resolution cannot mistake the
    ///         default for an accusation of agent 0.
    uint8 public constant NO_AGENT = type(uint8).max;

    /// @notice How long after betting closes the resolver has to resolve before
    ///         anyone may open the game for refunds.
    uint64 public constant RESOLVE_WINDOW = 24 hours;

    struct Game {
        uint64 closeAt; // betting closes at this unix timestamp
        bool exists;
        bool resolved;
        bool abandoned; // resolved via timeout — everyone is refunded their stake
        uint8 imposterId; // NO_AGENT until resolved
        bytes32 commitment; // keccak256(abi.encodePacked(gameId, imposterId, salt))
        uint256 totalPool;
    }

    address public resolver;

    mapping(uint256 => Game) public games;
    mapping(uint256 => uint256[AGENT_COUNT]) private _agentPool;
    mapping(uint256 => mapping(address => uint256[AGENT_COUNT])) private _stake;
    mapping(uint256 => mapping(address => uint256)) private _staked;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event GameCreated(uint256 indexed gameId, uint64 closeAt, bytes32 commitment);
    event BetPlaced(uint256 indexed gameId, address indexed user, uint8 agentId, uint256 amount);
    event GameResolved(uint256 indexed gameId, uint8 imposterId);
    event GameAbandoned(uint256 indexed gameId);
    event Claimed(uint256 indexed gameId, address indexed user, uint256 amount);
    event ResolverChanged(address indexed from, address indexed to);

    modifier onlyResolver() {
        require(msg.sender == resolver, "not resolver");
        _;
    }

    /// @param _resolver Backend wallet authorized to create and resolve games (0x0 defaults to deployer)
    constructor(address _resolver) {
        resolver = _resolver == address(0) ? msg.sender : _resolver;
        emit ResolverChanged(address(0), resolver);
    }

    function setResolver(address r) external onlyResolver {
        require(r != address(0), "zero address");
        emit ResolverChanged(resolver, r);
        resolver = r;
    }

    /// @notice Initialize a match.
    /// @param commitment keccak256(abi.encodePacked(gameId, imposterId, salt)) — required.
    ///        The salt must be 32 bytes of CSPRNG output. With only six possible imposter
    ///        values, a guessable salt makes the commitment a six-try brute force.
    function createGame(uint256 gameId, uint64 closeAt, bytes32 commitment) external onlyResolver {
        require(!games[gameId].exists, "game exists");
        require(closeAt > block.timestamp, "closeAt in past");
        require(commitment != bytes32(0), "commitment required");
        games[gameId] = Game({
            closeAt: closeAt,
            exists: true,
            resolved: false,
            abandoned: false,
            imposterId: NO_AGENT,
            commitment: commitment,
            totalPool: 0
        });
        emit GameCreated(gameId, closeAt, commitment);
    }

    /// @notice Stake native MON on an agent index (0..5)
    /// @dev The resolver knows the answer from the moment the game is simulated, so it
    ///      is barred from its own market.
    function bet(uint256 gameId, uint8 agentId) external payable {
        require(msg.sender != resolver, "resolver cannot bet");

        Game storage g = games[gameId];
        require(g.exists, "no game");
        require(!g.resolved, "resolved");
        require(block.timestamp < g.closeAt, "betting closed");
        require(agentId < AGENT_COUNT, "bad agent");
        require(msg.value > 0, "zero stake");

        _agentPool[gameId][agentId] += msg.value;
        _stake[gameId][msg.sender][agentId] += msg.value;
        _staked[gameId][msg.sender] += msg.value;
        g.totalPool += msg.value;

        emit BetPlaced(gameId, msg.sender, agentId, msg.value);
    }

    /// @notice Reveal the imposter. Also closes betting early (crew wins before the last round).
    /// @dev The commitment is verified unconditionally — there is no bypass.
    function resolve(uint256 gameId, uint8 imposterId, bytes32 salt) external onlyResolver {
        Game storage g = games[gameId];
        require(g.exists, "no game");
        require(!g.resolved, "already resolved");
        require(imposterId < AGENT_COUNT, "bad agent");
        require(
            keccak256(abi.encodePacked(gameId, imposterId, salt)) == g.commitment,
            "commitment mismatch"
        );

        g.resolved = true;
        g.imposterId = imposterId;
        emit GameResolved(gameId, imposterId);
    }

    /// @notice Permissionless escape hatch. If the resolver never came back within
    ///         RESOLVE_WINDOW of the market closing, anyone may open the game so every
    ///         bettor can withdraw their original stake.
    function abandon(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.exists, "no game");
        require(!g.resolved, "already resolved");
        require(block.timestamp > g.closeAt + RESOLVE_WINDOW, "too early");

        g.resolved = true;
        g.abandoned = true;
        emit GameAbandoned(gameId);
    }

    /// @notice Pro-rata payout. Full refund if the game was abandoned, or if nobody
    ///         backed the imposter.
    function payoutOf(uint256 gameId, address user) public view returns (uint256) {
        Game storage g = games[gameId];
        if (!g.resolved || claimed[gameId][user]) return 0;

        // Must precede any use of imposterId: an abandoned game never set one, and
        // _agentPool[gameId][NO_AGENT] would revert on a 6-element array.
        if (g.abandoned) return _staked[gameId][user];

        uint256 winPool = _agentPool[gameId][g.imposterId];
        if (winPool == 0) return _staked[gameId][user];

        return (g.totalPool * _stake[gameId][user][g.imposterId]) / winPool;
    }

    /// @notice Withdraw winnings or refunds
    function claim(uint256 gameId) external {
        require(games[gameId].resolved, "unresolved");
        require(!claimed[gameId][msg.sender], "already claimed");

        uint256 payout = payoutOf(gameId, msg.sender);
        require(payout > 0, "nothing to claim");

        claimed[gameId][msg.sender] = true; // effects before interaction

        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");

        emit Claimed(gameId, msg.sender, payout);
    }

    /// @notice Compute the commitment for a game off-chain-identically.
    /// @dev Pure and public — the hash is computable by anyone regardless. Exists so the
    ///      backend can assert its viem `encodePacked` matches this exactly before it
    ///      ships a game, rather than discovering a mismatch at resolve time.
    function commitmentFor(uint256 gameId, uint8 imposterId, bytes32 salt)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(gameId, imposterId, salt));
    }

    function pools(uint256 gameId) external view returns (uint256[AGENT_COUNT] memory) {
        return _agentPool[gameId];
    }

    function stakesOf(uint256 gameId, address user)
        external
        view
        returns (uint256[AGENT_COUNT] memory)
    {
        return _stake[gameId][user];
    }
}
```

## 9.3 Remix deployment steps

1. **Compile** — Solidity `0.8.24`, optimizer on (200 runs). Leave EVM version at default; if
   the deploy reverts on Monad, drop to `shanghai`, then `paris`.

2. **Test in Remix VM first** — Environment: *Remix VM (Cancun)*. Zero gas, instant, multiple
   funded accounts. This is the only testing this contract needs.
   - Deploy with `_resolver = 0x0000000000000000000000000000000000000000` (makes you resolver)
   - Pick a salt — any 32 bytes, e.g.
     `0x000000000000000000000000000000000000000000000000000000000000002a`
   - Call `commitmentFor(1, 2, <salt>)` and copy the result. There is no zero-commitment
     bypass; the hash must be real.
   - `createGame(1, <now+3600>, <commitment>)`
   - **The resolver cannot bet.** Switch to a second account → `bet(1, 2)` with Value 1 ether.
     Switch to a third → `bet(1, 4)` with 2 ether.
   - `resolve(1, 2, <salt>)` → `claim(1)` from the account that backed agent 2 → expect 3 ether.
   - **Refund path:** new gameId, both accounts bet agent 0, resolve to agent 5, confirm each
     `claim` returns exactly its own stake.
   - **Abandon path:** new gameId with a `closeAt` a minute out, place a bet, then call
     `abandon(gameId)` — it must revert with `too early`. This is the only branch you cannot
     fully exercise in the Remix VM without warping time; trust the code path and move on.

3. **Deploy to Monad** — MetaMask on Monad testnet, Environment: *Injected Provider – MetaMask*.
   Constructor arg = your **backend wallet address** (the one behind `RESOLVER_PK`), not your
   MetaMask address unless they are the same. Fund from the faucet first.

4. **Copy the ABI** — Compile tab → *Compilation Details* → ABI copy icon → paste into
   `frontend/src/chain/abi.ts` as `export const marketAbi = [...] as const;`. The `as const` is
   what gives wagmi its type inference.

5. **Save the address immediately** into `.env.local` and `contract/deployed.json`. Losing it
   mid-hackathon means redeploying and re-copying everything.

> Verify Monad's chain ID and RPC against docs.monad.xyz rather than trusting a remembered
> value — a wrong chain ID costs 15 confused minutes.

## 9.4 Commitment encoding — the one real trap

```ts
import { keccak256, encodePacked, toHex } from "viem";

const salt = toHex(crypto.getRandomValues(new Uint8Array(32)));
const commitment = keccak256(
  encodePacked(["uint256", "uint8", "bytes32"], [BigInt(gameId), imposterId, salt])
);
// keep `salt` on the server-side Game object until resolve()
```

`encodePacked`, **not** `encodeAbiParameters` — `abi.encodePacked` in Solidity is the packed
form. A mismatch fails at `resolve` with "commitment mismatch", which is a miserable thing to
debug live.

**Don't trust this — assert it.** The contract exposes `commitmentFor(gameId, imposterId, salt)`
as a free `pure` call that computes the same hash on-chain. Have the backend compare once at
startup and throw loudly if they disagree:

```ts
const onchain = await client.readContract({
  address, abi, functionName: "commitmentFor",
  args: [BigInt(gameId), imposterId, salt],
});
if (onchain !== commitment) throw new Error("commitment encoding mismatch");
```

The salt must be 32 bytes of CSPRNG output — never a timestamp, never derived from `gameId`.
There are only six possible imposter values, so a guessable salt turns the commitment into a
six-try brute force.

**Known limitation:** integer division leaves wei dust in the contract permanently. Irrelevant at
hackathon scale — the honest answer to a judge is "rounding dust; a sweep function is a v2 line
item."

---

# 10. Frontend

Three panels, one screen. No routing beyond lobby → game.

```
┌──────────────────────────────────────────────┐
│ AGENT IMPOSTER      ROUND 2/3    CLOSES 01:21│
├───────────────────────┬──────────────────────┤
│                       │                      │
│      OFFICE MAP       │    LIVE MARKET       │
│  6 rooms, CSS grid    │  Who is the Imposter?│
│  agents transition    │  pool % per agent    │
│  between them         │  [ BET ON … ]        │
│                       │                      │
├───────────────────────┴──────────────────────┤
│               LIVE EVENT FEED                 │
│  Hacker: "Where were you?"                    │
│  Politician: "That is irrelevant."            │
│  ☠️ Hacker was eliminated                     │
└──────────────────────────────────────────────┘
```

**Map:** six CSS-grid cells. Agents are absolutely positioned inside a room div with
`transition: all 600ms ease`. Changing the room re-parents the token and CSS animates it. That is
the entire movement system — no canvas, no sprite sheets, no game loop.

**Dead agents** stay on the map, greyed with a ☠️ overlay. Elimination must be visible.

**Market panel** reads `pools(gameId)` from the contract and renders proportions. Bet optimistically
in local state; the transaction is confirmation, not a gate — a slow testnet must never freeze
the UI.

**Reveal overlay** is full-screen, breaks the visual language of the rest of the app, and shows:
the traitor, your prediction, your stake, your payout. Spend the polish time here. This is the
moment that decides whether anyone says "run another one."

---

# 11. Execution Plan

**Ordering principle: build a fully playable game with a fake brain before writing a single LLM
call.** Every later layer is then an upgrade, not a dependency. Stop at any stage boundary and
you still have something to demo.

## 11.0 Where things actually stand

The design work ran ahead of the original hour plan, so the sequence below replaces it.

| | Status |
|---|---|
| Smart contract | **Deployed** — Monad testnet `0xFc7AcE…D7d9`, audited build verified on-chain |
| Design system + tokens | **Done** — `globals.css` |
| Live Match UI | **Done** |
| Engine | **Done** — `runGame()` → event log, stub brain, 1.29 kills/game |
| Agent brains | **Done** — LangChain + OpenAI, stub fallback, leak-checked |
| Playback / SSE | **Done** — `project()` + SSE, 85 frames, ~81s |
| Wallet + betting | **Done** — wagmi v3 + viem, bet/claim wired, commitment verified on-chain |
| Demo hardening | **Done** — golden game at `/game/golden`, §12 script rewritten, assets cleaned |

**All six stages are complete.** What is left is rehearsal, which is §12.0.

**Stack note:** agents run on **LangChain TS + OpenAI**, not the Anthropic SDK
(`gpt-4o-mini` for action selection, `gpt-4o` for dialogue, both env-overridable).
The `Brain` interface makes the provider a swap, not a rewrite.

Stage 5 in the old plan (polish) is effectively already banked. That buys roughly an hour,
and the plan below spends it on the piece the original plan missed — §11.3.

## Stage 1 · Deploy the contract — 20 min

Follow §9.3 exactly. Nothing downstream depends on the contract being *deployed*, but
everything downstream depends on the ABI being **frozen**, so do this first and never touch it
again.

- Remix VM test sequence (§9.3 step 2), including the refund path
- Deploy to Monad testnet
- Write `contract/deployed.json` and `frontend/src/chain/abi.ts` (`as const`)

**Checkpoint:** a real `claim` paid out in the Remix VM.

## Stage 2 · Engine with a stub brain — 75 min

```
engine/types.ts      GameEvent union, Agent, Game       ← write first
engine/config.ts     ROOMS, ADJACENCY, AGENTS, TASKS
engine/rules.ts      legalActions() + validate()
engine/brain-stub.ts decide() → random legal action
engine/simulate.ts   runGame() → GameEvent[]
```

Use the **design's** names, not the ones in §3.2 — see §11.7.

**Checkpoint:** `bun run src/engine/dev.ts` prints a complete 3-round log containing a sabotage,
a kill, a meeting, votes and a resolution. Zero AI involved. You now own a working game.

## Stage 3 · Projection + playback — 75 min ★ the risky one

This is the stage the original plan did not account for, and it is now the highest-risk work in
the project. See §7.2 for why.

```
engine/project.ts            project(events, upto) → Match
store/games.ts               Map<string, Game>
app/api/game/route.ts        POST → simulate, store, return id
app/api/game/[id]/stream/    GET SSE → replay the log on the §7.1 schedule
```

Then convert `LiveMatch` from static to live: subscribe to the SSE stream, accumulate events
into an array, run `project()` over them, render. **The component tree does not change** — only
where its `Match` comes from.

**Checkpoint:** you click START and watch a stub game play out in the real UI, crew walking
between rooms, chatter arriving, market moving. This is the demo floor. Protect it above
everything that follows.

## Stage 4 · Real brains — 60 min

```
bun add @anthropic-ai/sdk zod
```

```
agents/personalities.ts  6 prompt strings, ~40 words each
agents/memory.ts         buildView(agent, events)   ← the hidden-information rule
agents/brain.ts          decide() + speak(), structured output, 8s timeout
```

Swap `brain-stub` for `brain` behind the same signature. On timeout or parse failure, fall
straight back to the stub — the stub is never deleted.

**Checkpoint:** agents accuse each other citing events that actually happened, and killing the
network mid-generation still produces a complete game.

## Stage 5 · Wallet, betting, resolution — 60 min

```
bun add wagmi viem @tanstack/react-query
```

```
chain/monad.ts     chain def + wagmi config
chain/useMarket.ts pools / bet / claim hooks
```

Wire the existing `BetTicket` to a real transaction — the UI is already built, this is only
plumbing. The resolver posts `createGame` before playback begins and `resolve` when the log
ends.

**Checkpoint:** a real MON bet on Monad testnet pays out to a second wallet.

## Stage 6 · Demo hardening — 30 min · **DONE**

- [x] **Golden game.** `bun --env-file=.env.local src/engine/golden.ts 10 --llm` scores a batch
      of candidates for how well they demo — kills, a discovered body, wrongful ejections,
      going the full three rounds, dialogue in the 8–24 line sweet spot — and writes the best
      to `public/golden-game.json`. Served at `/game/golden` and `?demo=golden`, replayed
      entirely client-side: no API, no SSE, no model, no chain.
- [x] **Same code path as the live game.** The timing table moved to `engine/timing.ts` so the
      fallback and the real thing share it. Both project through `engine/project.ts`. The
      safety net cannot drift from the product it stands in for.
- [x] **Betting disabled on the recording.** No `marketId` is passed, so `BetTicket` shows
      "Market not open". A ticket that cannot settle should not be clickable.
- [x] Deleted the five leftover `create-next-app` SVGs in `public/`.
- [x] Lobby carries a discreet "or watch a recorded match" link — one click beats typing a URL
      correctly while a room watches.
- [x] §12 rewritten against the shipped build, with a fallback ladder and the questions.
- [ ] **Run the §12 script twice, out loud, on the machine you will present from.** Not
      something anyone can do for you.

**Bug found and fixed while baking the golden game.** Every line of dialogue was being clipped
mid-word — `"CIRCE is a,"`, `"I did not_"`. Cause: `z.string().max(180)` becomes `maxLength` in
the JSON schema, and OpenAI's constrained decoder treats that as a hard stop at exactly
character 180 rather than a hint. The caps are gone from the schemas; brevity is asked for in
the field descriptions and enforced afterwards by `clip()`, which cuts on a sentence boundary.
This affected every LLM game, not just the golden one.

## 11.7 Naming: the design won

The comp shipped with different names than §3.2/§8.4, and the comp is what is built. Adopt it —
retrofitting the UI to the PRD would throw away working code for no gain.

| | Use these | Not these |
|---|---|---|
| Agents | ATLAS · BYTE · CIRCE · DELTA · ECHO · FLINT | Sherlock, Chaos, Politician, Hacker, Uncle, Degen |
| Rooms | Standup Room · Server Closet · Kitchen · Whiteboard · Pods · Demo Stage | MAIN_HALL, DEV_ROOM, … |

The §3.2 adjacency graph still holds — rename its nodes, keep its shape. The personalities in
§8.4 still hold as *voices*; only the labels change. Agent → contract index is already fixed in
`lib/match.ts` (ATLAS 0 … FLINT 5) and must not be reordered, since it is what `bet()` takes.

## If you run short

Cut in this order, last first:

1. **Stage 6** — hurts only if something breaks live
2. **Stage 4** — a stub-brain game still moves, kills and votes; it just argues stupidly
3. **Stage 5** — you lose the Monad story, which is most of the point

Stages 1–3 are the irreducible product. Stage 3 is what turns a static mockup into a thing that
plays.

---

# 12. Demo Script (2 minutes)

Rewritten against the shipped build. The §11.7 names are the real ones; the old script used
Hacker/Politician/Server Room, which no longer exist.

## 12.0 Before you stand up

Run this checklist on the machine you will actually present from, on the venue wifi.

- [ ] `bun run dev` is already running. Never start it in front of people.
- [ ] `http://localhost:3000` open in one tab, `http://localhost:3000/game/golden` in a second.
- [ ] **MetaMask is on a wallet that is NOT the resolver.** `bet()` reverts with
      `resolver cannot bet` for `0x462dD9…`. This is the single most likely live failure and it
      is a deliberate contract rule, not a bug. Use a second funded account.
- [ ] That wallet is on Monad testnet and holds MON.
- [ ] `public/golden-game.json` exists and is freshly baked with `--llm`.
- [ ] Zoom to ~110%. The chatter panel is what people read; it must be legible from the back.
- [ ] Notifications off.

## 12.1 The beat sheet

Total speaking time ~2 min against ~80s of playback, so you are talking over the middle third.

**0:00 — Lobby.** Six crewmates idling.

> "Six AI agents are working on a hackathon project overnight. One of them has been told to
> sabotage it. The other five don't know which."

**0:12 — Click "Start new match".** It says *Generating…* for a few seconds. Do not fill the
silence apologetically — explain it, because this pause is the architecture:

> "It's playing the entire match right now — every move, every argument, every vote — before
> showing me a single frame. That's deliberate. Nothing you're about to watch can buffer or
> stall waiting on a model."

**0:22 — Playback starts.** Agents move between rooms. Point at the map.

> "They're picking these moves themselves. Each one only knows what it personally witnessed —
> who was in the room, who walked in from where. Nobody has a god view. Neither do you."

**0:35 — The market.** Point at the six rows and the odds.

> "The Imposter was committed on-chain before this started — a hash of the answer plus a salt,
> posted in the transaction that opened the market. So the answer was fixed before a single
> bet could be placed. We can't move it now, and you don't have to trust me about that."

**0:45 — Place a real bet.** Pick whoever the odds like. Confirm in MetaMask.

> "Ten MON on ECHO. That's a real transaction on Monad testnet."

**0:55 — A body is found. The meeting fires.** Stop talking. Let two or three lines land — this
is the product and it needs silence.

> *(read one line out loud, then:)* "That's not a script. It's responding to what the agent
> before it actually said."

**1:20 — The vote.** Someone gets ejected.

> "And they're wrong. They just ejected a crew member."

**1:35 — Reveal.** The Imposter is shown, `resolve()` fires, the commitment is verified on-chain.

> "The reveal transaction has to produce a preimage matching that original hash, or the contract
> rejects it. Provably the same answer as before betting opened."

**1:45 — Claim.** Winners split the whole pool, parimutuel.

> "No house, no counterparty, no fee. Everyone who read it right splits everything that was
> staked."

**1:55 — Land it.**

> "The agents are autonomous inside the game engine. Monad handles the market and the
> settlement. The audience isn't chatting with an AI — they're reading one, and betting that
> they read it better than the other five did."

## 12.2 When it breaks

The fallback ladder, cheapest first. Practise the top two — they are the ones you will use.

| What broke | Do this | Costs you |
|---|---|---|
| Generation is slow or OpenAI 500s | Keep talking through it; the stub brain takes over automatically | Weaker dialogue, nothing visible |
| Wifi dies · OpenAI is down · anything at all | Second tab: **`/game/golden`** — a recorded match replayed from disk. No API, no SSE, no chain | Betting is disabled; say "this one's a recording" and narrate the same beats |
| MetaMask won't connect or bet reverts | Skip the bet, keep the playback running, show the market opening tx on the explorer instead | The money beat becomes a story instead of a demo |
| Everything is on fire | `/game/golden` and talk over it | Nothing — this is why it exists |

The golden game replays through the same `project()` and the same timing table as the live path,
so the beats land where you rehearsed them.

## 12.3 Questions you will get

- **"Are the agents actually deciding, or is it scripted?"** Deciding. `engine/` never calls a
  model and the model never mutates state — it picks from a list of legal moves the engine
  hands it. Show `src/agents/brain.ts` and the `legalActions()` call.
- **"How do I know you can't rig the outcome?"** Commit–reveal. Show `commitmentFor()` on the
  contract and the `createGame` transaction on the explorer, timestamped before the bets.
- **"What stops the resolver betting on itself?"** `bet()` rejects `msg.sender == resolver`.
- **"What if you just never reveal?"** `abandon()` is permissionless after 24 hours and refunds
  everyone their own stake.
- **"Why not run the agents live?"** Because then every model timeout happens in front of you.
  Generation is 3–20s; playback must never stall.

---

# 13. Risk Register

| Risk | Mitigation |
|---|---|
| Generation takes 4 minutes | `effort: "low"` on actions, `Promise.all` per round, 8s hard timeout → stub fallback |
| Boring game, no kills | Forced drama schedule (§3.3) — the engine overrides a passive Imposter |
| Monad testnet flaky mid-demo | Bet UI updates optimistically; the tx confirms, it does not gate |
| `imposterId` leaks to the browser | Single redaction choke point (§6.3); grep for `imposterId` in `src/app` and `src/components` before demoing |
| Commitment mismatch at resolve | Verify `encodePacked` once in the Remix VM during H0 |
| Behind schedule at H4 | Ship the stub-brain game with betting. It is still a complete product |

**The biggest trap** is building the live real-time engine because it feels more impressive. It
is not — nobody in the audience can tell, and it is the single most likely thing to fail on
stage.

---

# 14. What This Is Not

Not "Among Us with ChatGPT." It is a spectator prediction market where autonomous agents generate
a live social-deduction drama and a crowd stakes money on reading it correctly.

The AI is not generating text. It is moving, working, lying, sabotaging, killing, accusing, and
voting. The audience is not chatting with an AI. They are **watching, predicting, and risking
conviction.**

---

# 15. Next Surfaces — Lobby, Leaderboard, Home

**Built.** Stage status at §15.8. Two measurements taken before writing this changed its shape, so they come
first.

## 15.0 The two findings

**Finding 1 — the pool has exactly one bettor in it.**

Every viewer who clicks *Start match* generates their own private match. The frames live in that
tab (§2.3). So two people on the site are watching two different games, betting into two
different markets. The parimutuel pool — the entire economic premise — currently has a
population of one.

That is not a bug in the market; the contract is fine. It is a missing surface. **A lobby is not
a list page, it is the thing that makes the market mean anything**, and it is the reason to
build any of this. Leaderboards and home-page stats are garnish until several people can watch
the same match.

**Finding 2 — the public RPC will not let us derive a leaderboard from history.**

Measured against `https://testnet-rpc.monad.xyz`:

```
eth_getLogs is limited to a 100 range
block time             0.30 s
100-block window       30 s of chain time
to cover 24h           2,861 requests                 <- not viable per pageview
one game's 300s window ~994 blocks = 10 getLogs calls <- perfectly viable
```

The obvious design — "scan `BetPlaced` and `GameResolved` since the deploy block, aggregate,
done" — cannot work here. Worth stating plainly, because an earlier scan in this repo *appeared*
to work while silently swallowing every range error and reporting zero events.

The last line is the way through: scanning **one game's** betting window costs ten calls. So a
leaderboard is affordable if, and only if, we already know which games exist and roughly where
to look. That means keeping a small index of our own.

## 15.1 The shape that follows

One store, introduced once, unlocks all three surfaces:

| Holds | Why |
|---|---|
| `frames` + `durations` per game | So anyone can watch the match, not only its creator |
| `gameId`, `createdBlock`, `startedAt` | So the leaderboard knows where to scan, in ten calls per game |
| the sealed reveal ticket | So a match resolves even if its creator closed the tab |

**Vercel Blob** is the cheapest fit: `put()` plus a public `fetch()`, free tier, no schema.
Upstash Redis or Vercel KV work equally well; nothing below depends on which.

Three decisions to make up front:

- **Frames are safe to publish.** They are already redacted — `Match` has no field that can hold
  `imposterId` (§6.3), verified against the live payload.
- **Put `revealAt` inside the sealed ticket.** Storing the ticket publicly means anyone can
  trigger a reveal, and an early reveal closes betting early. Sealing the timestamp *with* the
  answer lets `unseal()` refuse a premature reveal, and puts the guard under the same AES-GCM
  tag — so it cannot be edited.
- **Nothing in the store is trusted.** Every number shown is recomputed from contract view calls
  (`games`, `pools`, `stakesOf`, `payoutOf`), which have no range limit. The store answers only
  *which games exist and where*; the chain answers *what happened*.

## 15.2 Stage A - The match store — 60 min

The keystone. Nothing else is worth building first.

- `src/store/matches.ts` — `putMatch(game, frames, durations)` and `getMatch(id)` over Blob.
- `POST /api/game` also writes the match, and returns only the id. The handoff still stashes
  frames locally, so the creator's playback starts instantly with no extra round trip.
- `GET /api/match/[id]` — returns frames for everyone else. `LiveGame` falls back to it when
  `sessionStorage` is empty, replacing "that match isn't in this tab".
- `revealAt` moves inside the sealed ticket; `unseal()` rejects an early reveal.
- Sweep matches older than a day, so the free tier never becomes a factor.

**Checkpoint:** open a running match's URL in a private window and watch it play.

## 15.3 Stage B - Home — 75 min

The current page is a headline, six crewmates and a button. It reads like a placeholder because
it is one. Every band below is fed by data that already exists — no invented numbers.

| Band | Content | Source |
|---|---|---|
| Hero | Headline, subhead, primary CTA, and one live line: *N markets open · X MON staked today* | `games()` + `pools()` over the store index |
| How it works | Three numbered steps — **Watch · Read · Stake**. A spectator-only betting game is unusual enough that ten seconds of explanation earns its space | static |
| The crew | The six as a real roster: name, trait, hue chip, *times imposter*, *how often the crowd caught them* | `GameResolved` per indexed game |
| Live now | Two or three open markets with pools and a countdown, linking into the lobby | store index + `games()` |
| Recent verdicts | Last five resolved: who lied, pool size, whether the crowd read it right, tx link | store index + `games()` |
| Footer | Contract address, explorer link, testnet warning | static |

Constraints from `design.md` §9 this must not break: red marks only *live*, *sabotage* and *the
action that spends money*; comparable numbers set in mono; 2px rules between bands; no second
accent hue; never sync the crew's idle loops.

*Recent verdicts* is the band that matters most. A stranger cannot tell whether any of this is
real, and five settled games with transaction links answer that faster than any amount of copy.

## 15.4 Stage C - Leaderboard and My bets — 75 min

- `src/app/api/stats/route.ts` — per indexed game, ten `getLogs` calls across its betting window
  to collect `BetPlaced`, then contract reads for the outcome. **Incremental:** aggregates are
  cached per game and never recomputed, so cost is bounded by *new* games, not by history.
- Ranking: net P&L (`sum(claimed) - sum(staked)`), with hit rate, games played, biggest single
  win. Sort by P&L, but show hit rate beside it so one lucky bet doesn't read as skill.
- `/leaderboard` — the table, with your own row pinned when connected.
- `/my-bets` — the same aggregate filtered to the connected address, plus unclaimed winnings and
  a claim button. It falls out nearly free, and it is the page most likely to bring someone back.

**Fallback if the scan is slower under load than measured:** an [Envio
HyperIndex](https://envio.dev) deployment on Monad testnet removes the range limit and turns all
of this into one GraphQL query. It is the correct long-term answer, deferred only because it
adds a service to deploy.

## 15.5 Stage D - Lobby — 60 min

With matches shared, this becomes a real page rather than a list of links.

- **Live now** — matches still playing, with position, pool, bettor count. Join mid-match.
- **Opening soon / awaiting reveal** — created, or resolved but unclaimed.
- **Recently settled** — outcome, pool, payout multiple.
- A *Start a new match* card, since generating one is still the main action.

Seek-on-join is what makes it feel live: the store holds each match's start time, so a late
arrival computes its frame index from wall-clock instead of starting at zero.

## 15.6 Order, and what to cut

```
A  match store ---+---> D  lobby        (D cannot exist without A)
                  +---> B  home ---> C  leaderboard / my bets
```

Build A first even though B is the visible one: B and C are both better with it, and D is
impossible without it.

Cut in this order, last first:

1. **My bets** — cheapest to add back later
2. **Leaderboard** — most new plumbing for the least visible payoff
3. **Lobby** — hurts, because it is what makes the market real
4. **Home** — never cut; it is the page everyone sees first

If only one thing ships, ship **A + D**. A prettier home page in front of a market with one
participant is polish on the wrong problem.

## 15.7 Risks

| Risk | Mitigation |
|---|---|
| Blob becomes a hard dependency of match creation | Make the write best-effort, exactly as the chain calls are (§2.3). A failed write means the match plays for its creator only — today's behaviour |
| Log scanning is slower under real load than measured | Cache per game, never recompute; fall back to Envio |
| The leaderboard is empty at demo time | Seed it by playing a few matches from two wallets beforehand. An empty leaderboard is worse than no leaderboard |
| Home grows past one screen of scannable content | Six bands is the ceiling. If a seventh is wanted, something leaves |
| Shared matches leak the imposter | They cannot — frames carry no role field. Re-run `leak-check` plus the payload grep after Stage A anyway |

## 15.8 What shipped

| Stage | Status |
|---|---|
| A · match store | **Done** — `store/matches.ts`, Blob with a filesystem fallback for local dev; `GET /api/match/[id]`; seek-on-join in `Replay` |
| B · home | **Done** — six bands in `components/home/Bands.tsx`, every number read back from the contract |
| C · leaderboard + my bets | **Done** — `store/stats.ts`, `GET /api/stats`, `/leaderboard`, `/my-bets` |
| D · lobby | **Done** — `/lobby`, live / start / settled |
| Nav | **Done** — the four `TopBar` links were dead; they now go somewhere, with an active state |

Verified end to end against a production build: a match is created and shared,
a second client with no `sessionStorage` fetches and plays it, an early reveal
is refused with 425, a reveal after playback lands on-chain, and the
resolution shows up in `/api/stats` attributed to the right agent.

Two decisions changed during the build:

- **`revalidate` was wrong for `/api/stats`.** It prerendered the route at
  build time — when the store is necessarily empty — and served that snapshot
  to the first visitor after every deploy. Replaced with `force-dynamic` plus
  an 8s TTL cache inside `buildStats()`, so the cost is the same and nothing
  is ever stale in a way anyone notices.
- **A filesystem backend was added** so the whole feature can be developed
  without provisioning Blob. It is dev-only by construction: on Vercel each
  lambda has its own `/tmp`, so the token decides which backend is used, not
  `NODE_ENV`.

Not covered by any of this: betting still needs a wallet, so the leaderboard
stays empty until real bets land. Seed it from two wallets before demoing —
§15.7 says why an empty leaderboard is worse than none.

---

# 16. Making It Actually Multiplayer

§15 made matches *shared* — anyone could open one and watch. It did not make them
*bettable by more than one person*, which is a different thing, and the gap was
entirely in timing.

## 16.0 Why sharing was not enough

Three lines of the old create route decided it:

```ts
const startedAt = Date.now();          // the match begins NOW
openMarket(game)                       // closeAt = now + 300s (never binds)
// ...resolve() fires when playback ends, ~80s later
```

`resolve()` sets `resolved = true`, and `bet()` rejects a resolved game. So the real
betting window was **about 64 seconds, beginning the instant somebody clicked a button
nobody else had been warned about**. The 300-second `closeAt` never bound, because the
reveal always beat it. A second bettor had to discover the match and get a transaction
confirmed inside a minute of a private event.

That is not a thin market. It is a coincidence with a market attached.

Two smaller things pointed the same way:

- **Resolution depended on a tab.** Whoever's playback finished first called `resolve`.
  If that person closed the tab, everyone else's stake sat unresolved until the 24h
  `abandon()` window.
- **`spectators` was fabricated.** `1 + (game.seed % 1500)` — an invented crowd, on a
  screen where every other number is read back from the contract.

## 16.1 A schedule, not an instant

```
create ──► announce ──► countdown (90s) ──► playback ──► reveal
           │                                 │
           └── in the lobby, taking bets ────┘   betting closes at the final meeting
```

`startedAt = Date.now() + LOBBY_MS`. The match is announced immediately and begins after
the countdown, so anyone reading the lobby has a real window in which to act.

Betting closes on-chain at `startedAt + closesAtMs` — the moment the final meeting
begins. So staking runs through the countdown *and* into the first rounds, which keeps
the odds moving as evidence lands. Nobody gains by watching faster, because everyone
starts on the same frame.

**Nothing is synchronised over a wire.** Playback position is a pure function of wall
clock against `startedAt`, so a viewer who arrives late, reloads, or backgrounds the tab
computes the same frame as everyone else. The seek machinery already existed for §15;
scheduling is what made it meaningful.

## 16.2 Intermissions — the round is over, now decide

Continuous playback ran a match in ~80 seconds. Watchable; nearly impossible to bet on.
By the time you had read an argument and decided it was a lie, the round had moved on.

New information arrives when a vote lands, so that is where playback holds:

```
INTERMISSION_MS = 14s, inserted after each ejection except the last
playback   74.3s ──► 102.3s
betting window   64s ──► 182s   (90s countdown + 92s of play)
```

The pause is **part of the timeline**, added into `durations` by `planPlayback`, not a
client-side stop. That matters: every viewer holds on the same frame at the same moment,
so the odds they are all looking at are the same odds. It also means `closesAtMs` stays
exact, and seek-on-join still lands correctly for someone arriving mid-intermission.

No pause after the final vote — betting has already closed and the only thing left is the
reveal.

## 16.3 Reveal without a spectator

`store/reap.ts` settles any match whose playback has finished but which nobody resolved,
using the stored ticket. It is called opportunistically from `/api/stats`, which the lobby
polls, so a busy floor reaps itself; `/api/reap` exposes it for a cron on top of that.

Rate-limited internally, idempotent, and every guard still applies — the ticket refuses to
open before the match could have finished, and the contract checks the reveal against the
commitment posted before betting opened.

## 16.4 What changed

| | |
|---|---|
| `engine/timing.ts` | `LOBBY_MS`, `INTERMISSION_MS`, and `pauseBefore[]` in the plan |
| `api/game` | schedules the start; `closeAt` is now the final meeting, not a fixed 300s |
| `chain/resolver.ts` | `openMarket` takes an absolute close time |
| `components/live/PreMatch.tsx` | countdown, the opening board, an invite-someone link |
| `components/live/Replay.tsx` | renders intermissions as a stated betting window |
| `components/live/LiveGame.tsx` | routes between countdown, playback and over, all from the clock |
| `store/reap.ts`, `api/reap` | reveal without a spectator |
| `MatchBar` | the invented spectator count replaced with the real pool |
| `lobby`, home `LiveNow` | a "taking bets" state distinct from "playing now" |
| `lib/useStats.ts` | `useNow()` — one ticking clock, via `useSyncExternalStore` |

## 16.5 Verified

```
create            -> announced, starts in 84s, shared: true
on-chain closeAt  -> 170s of betting from creation (was ~64s)
intermissions     -> 2 x 14s, after the R1 and R2 votes only
second client     -> sees the countdown, the board and the bet ticket
leak check        -> no imposterId in any frame
reap              -> resolved a finished match nobody was watching
```

## 16.6 Still open

- **Nobody schedules matches.** Someone has to press the button. Vercel Hobby cron only
  fires once a day, so "there is always a game about to start" needs either Pro, or a
  first-visitor-creates heuristic with a cooldown.
- **No presence.** The pool size stands in for a crowd, which is honest but does not tell
  you whether anyone else is in the room right now.
- **`LOBBY_MS` is a guess.** 90s is long enough to share a link and connect a wallet, and
  short enough not to feel dead. Worth tuning against a real audience.

## 16.7 Bug found in review: the Claim button that would not go away

Reported against a real row — *"DELTA was the Imposter · 0.30 staked · lost · [Claim]"* — which
is self-contradictory, and it was. Traced to game `2298955640` on chain, and it turned out to be
three bugs sharing one cause.

```
winPool: 0      nobody backed DELTA, so the contract refunds every stake (§3)
claimed: true   already collected; payoutOf therefore returns 0
```

1. **The button persisted after claiming.** `stats.ts` cached the whole `GameStat` for any
   resolved game, on the reasoning that resolved games never change. They do:
   `claimed[gameId][user]` flips on collection and `payoutOf` reads it. The cache went on
   reporting 0.30 as claimable forever.
2. **"lost" was wrong.** With no stake on the Imposter the position was *refunded*, not lost —
   a payout without having been right. There are three outcomes, and the UI only had two.
3. **Claiming lowered your ranking.** The leaderboard summed `payout`, which drops to zero on
   collection, so cashing out reduced your net P&L.

Fixes: cache only the log scan (immutable once betting closes) and re-read amounts every build;
add `won` — entitlement independent of collection — and use it for P&L; add `claimed` and render
a CLAIMED badge; refresh stats when a claim confirms rather than waiting out the poll. Also
`{n} agents backed` was never pluralised.

The lesson worth keeping: **"resolved" is not the same as "immutable".** A settled game still
has state that moves.
