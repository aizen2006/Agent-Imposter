/* Engine types. Written first; everything else conforms to this.
   Names follow the shipped UI (prd.md §11.7), not the original §3.2 draft. */

export type RoomId =
  | "STANDUP"
  | "SERVER_CLOSET"
  | "KITCHEN"
  | "WHITEBOARD"
  | "PODS"
  | "DEMO_STAGE";

export type Role = "CREW" | "IMPOSTER";

export type ActionType =
  | "MOVE"
  | "TASK"
  | "WAIT"
  | "FAKE_TASK"
  | "SABOTAGE"
  | "KILL";

/** Agent index 0–5. This is the id `bet(gameId, agentId)` takes on-chain —
    the order in config.ts is fixed and must never be reordered. */
export type AgentIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type AgentState = {
  index: AgentIndex;
  name: string;
  /** SERVER ONLY. Never reaches a GameEvent except via ELIMINATED / RESOLVED. */
  role: Role;
  room: RoomId;
  alive: boolean;
  /** Tasks this agent has genuinely completed. Crew only; the Imposter's
      FAKE_TASK never lands here even though it emits an identical event. */
  tasksDone: number;
};

/* ── Events ───────────────────────────────────────────────────────────────
   The append-only log is the only state that matters. Everything the UI
   renders, everything an agent knows, and the whole replay derive from it.

   Nothing here names the Imposter until ELIMINATED or RESOLVED. A KILL
   names its victim and its room — never its killer. */

export type GameEvent =
  /** Carries the opening roster and positions so the log is self-contained:
      an agent that never moves is still placeable, which both the memory
      filter and the Stage 3 projection depend on. */
  | {
      t: "GAME_STARTED";
      round: 0;
      scenario: string;
      lineup: { id: AgentIndex; name: string; room: RoomId }[];
    }
  | { t: "AGENT_MOVED"; round: number; agentId: AgentIndex; from: RoomId; to: RoomId }
  | { t: "TASK_DONE"; round: number; agentId: AgentIndex; room: RoomId; task: string }
  | { t: "SABOTAGE"; round: number; room: RoomId; what: string; witnesses: number }
  | { t: "KILL"; round: number; victimId: AgentIndex; room: RoomId }
  | {
      t: "BODY_FOUND";
      round: number;
      victimId: AgentIndex;
      room: RoomId;
      finderId: AgentIndex;
    }
  | { t: "MEETING_START"; round: number }
  | {
      t: "SAID";
      round: number;
      agentId: AgentIndex;
      text: string;
      room: RoomId;
      meeting: boolean;
      /** Set when the line is a direct accusation — drives the ACCUSES badge. */
      accuses?: AgentIndex;
    }
  | { t: "VOTE"; round: number; agentId: AgentIndex; targetId: AgentIndex | null }
  | { t: "ELIMINATED"; round: number; agentId: AgentIndex; role: Role }
  | { t: "NO_ELIMINATION"; round: number; reason: "tie" | "abstained" }
  | { t: "RESOLVED"; round: number; imposterId: AgentIndex; crewWon: boolean };

export type EventType = GameEvent["t"];

/* ── Game ──────────────────────────────────────────────────────────────── */

export type Game = {
  id: string;
  /** uint256 the contract keys off. */
  numericId: bigint;
  seed: number;
  scenario: string;
  agents: AgentState[];
  events: GameEvent[];

  /** SERVER ONLY — never serialized. */
  imposterId: AgentIndex;
  /** SERVER ONLY — held until resolve(). */
  salt: `0x${string}`;

  round: number;
  finished: boolean;
  crewWon: boolean;
};

/* ── Brain ────────────────────────────────────────────────────────────────
   The stub and the LLM implement the same interface, so Stage 4 is a swap
   rather than a refactor. Async from the start for the same reason. */

export type Decision = {
  action: ActionType;
  /** RoomId for MOVE, agent name for KILL, else null. Validated by rules.ts —
      the engine adjudicates, the brain only requests. */
  target: string | null;
  /** Public line. May be a lie. */
  say: string;
};

export type ActionContext = {
  self: AgentState;
  round: number;
  /** What this agent could have witnessed — see agents/memory.ts. */
  view: GameEvent[];
  /** Engine-supplied legal options. The brain picks from these. */
  options: LegalOption[];
  /** Names of agents in the same room, right now. */
  roommates: string[];
  /** The task available here, if any. */
  taskHere: string | null;
  /** Adjacent rooms holding exactly one living agent — i.e. somewhere you
      could walk to and be alone with them. Public information: anyone can see
      who went where. The Imposter is simply the one who acts on it. */
  adjacentSolo: { room: RoomId; agent: string }[];
};

export type MeetingContext = {
  self: AgentState;
  round: number;
  view: GameEvent[];
  /** Statements already made this meeting, in order. */
  transcript: { name: string; text: string }[];
  /** Agents that can be accused or voted for. */
  candidates: string[];
};

export type LegalOption = {
  action: ActionType;
  target: string | null;
  /** Human-readable, fed to the LLM in Stage 4. */
  label: string;
};

export interface Brain {
  decide(ctx: ActionContext): Promise<Decision>;
  speak(ctx: MeetingContext): Promise<{ text: string; accuses: string | null }>;
  vote(ctx: MeetingContext): Promise<{ target: string | null }>;
}
