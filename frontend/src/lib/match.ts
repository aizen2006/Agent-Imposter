/* Shape of a live match as the UI consumes it.
   The engine (src/engine) will produce this from its event log; until then
   `demoMatch` below stands in, mirroring the Claude Design comp exactly. */

export type AgentId = "ATLAS" | "BYTE" | "CIRCE" | "DELTA" | "ECHO" | "FLINT";

export type Agent = {
  id: AgentId;
  /** Index 0–5 — the id the smart contract bets against. */
  index: number;
  /** OKLCH hue. The only thing that varies between crewmates. */
  hue: number;
  /** Letter shown on the map tag. */
  tag: string;
  trait: string;
  alive: boolean;
  /** Renders the pill in accent — something about this agent looks off. */
  flagged?: boolean;
  /** Shown instead of `trait` when flagged. */
  flag?: string;
};

export type Occupant = {
  agent: AgentId;
  motion?: "bob" | "waddle";
  duration?: number;
  delay?: number;
  says?: string;
  accused?: boolean;
};

export type Room = {
  name: string;
  occupants: Occupant[];
  /** Head count shown top-right. Omitted on rooms with a status badge. */
  count?: number;
  badge?: { label: string; tone: "accent" | "soft" | "ghost" };
  /** Mono line under the header — sabotage forensics. */
  meta?: string;
  /** Prose shown when the room has no crew in it. */
  note?: string;
  state?: "default" | "sabotage" | "empty" | "ghost";
};

export type MarketOutcome = {
  agent: AgentId;
  /** Share of the pool, 0–100. Drives the fill bar width. */
  share: number;
  /** Parimutuel payout multiple = totalPool / agentPool. */
  odds: number;
  note: string;
  leading?: boolean;
};

export type ChatLine =
  | {
      kind: "say";
      agent: AgentId;
      time: string;
      where?: string;
      text: string;
      accuses?: AgentId;
    }
  | { kind: "system"; text: string }
  | { kind: "typing"; agent: AgentId; text: string };

export type Match = {
  id: number;
  title: string;
  round: number;
  totalRounds: number;
  aliveCount: number;
  spectators: number;
  /** Seconds until the market closes. */
  closesIn: number;
  poolMon: number;
  bettors: number;
  agents: Agent[];
  rooms: Room[];
  market: MarketOutcome[];
  chatter: ChatLine[];
  recap: {
    kicker: string;
    headline: string;
    detail: string;
  };
};

export const AGENTS: Record<AgentId, Agent> = {
  ATLAS: { id: "ATLAS", index: 0, hue: 250, tag: "A", trait: "overconfident", alive: true },
  BYTE: {
    id: "BYTE",
    index: 1,
    hue: 155,
    tag: "B",
    trait: "keeps to itself",
    alive: true,
    flagged: true,
    flag: "9 min alone",
  },
  CIRCE: { id: "CIRCE", index: 2, hue: 305, tag: "C", trait: "asks questions", alive: true },
  DELTA: { id: "DELTA", index: 3, hue: 75, tag: "D", trait: "out R2", alive: false },
  ECHO: { id: "ECHO", index: 4, hue: 205, tag: "E", trait: "repeats itself", alive: true },
  FLINT: {
    id: "FLINT",
    index: 5,
    hue: 340,
    tag: "F",
    trait: "loud",
    alive: true,
    flagged: true,
    flag: "3 accusations",
  },
};

export const agent = (id: AgentId): Agent => AGENTS[id];

export const demoMatch: Match = {
  id: 4102,
  title: "Ship it before dawn",
  round: 3,
  totalRounds: 5,
  aliveCount: 4,
  spectators: 1208,
  closesIn: 42,
  poolMon: 1842,
  bettors: 306,
  agents: Object.values(AGENTS),

  rooms: [
    {
      name: "Standup Room",
      count: 2,
      occupants: [
        { agent: "ATLAS", motion: "bob", duration: 2.8 },
        { agent: "CIRCE", motion: "bob", duration: 3.4, delay: 0.4 },
      ],
    },
    {
      name: "Server Closet",
      state: "sabotage",
      badge: { label: "SABOTAGE", tone: "accent" },
      meta: "14:02 · 0 witnesses",
      occupants: [
        {
          agent: "BYTE",
          motion: "waddle",
          duration: 2.4,
          says: "“rotating keys, don’t look”",
        },
      ],
    },
    {
      name: "Kitchen",
      state: "empty",
      occupants: [],
      note: "Empty. Coffee cold.",
    },
    {
      name: "Whiteboard",
      badge: { label: "LOUDEST", tone: "soft" },
      occupants: [
        {
          agent: "FLINT",
          motion: "bob",
          duration: 2.2,
          accused: true,
          says: "“it was BYTE, obviously”",
        },
      ],
    },
    {
      name: "Pods",
      state: "ghost",
      badge: { label: "GHOST", tone: "ghost" },
      occupants: [{ agent: "DELTA" }],
      note: "DELTA · voted out R2, was innocent",
    },
    {
      name: "Demo Stage",
      count: 1,
      occupants: [
        { agent: "ECHO", motion: "bob", duration: 3.1, delay: 0.8 },
      ],
      note: "rehearsing the pitch, badly",
    },
  ],

  market: [
    {
      agent: "FLINT",
      share: 41,
      odds: 2.44,
      note: "accused 12s after the sabotage",
      leading: true,
    },
    { agent: "BYTE", share: 29, odds: 3.45, note: "nine unwitnessed minutes" },
    { agent: "ATLAS", share: 18, odds: 5.55, note: "alibi: CIRCE (mutual, suspicious)" },
    { agent: "ECHO", share: 12, odds: 8.3, note: "reported it first — bold move" },
  ],

  chatter: [
    {
      kind: "say",
      agent: "ECHO",
      time: "14:01:48",
      text: "The build passed at 13:58. Then it didn't. Nothing changed. Cool. Normal.",
    },
    {
      kind: "say",
      agent: "BYTE",
      time: "14:02:11",
      where: "SERVER CLOSET",
      text: "I was rotating the API keys. Alone. For nine minutes. Totally normal thing to do.",
    },
    { kind: "system", text: "SABOTAGE · CI pipeline poisoned · 0 witnesses" },
    {
      kind: "say",
      agent: "FLINT",
      time: "14:02:19",
      accuses: "BYTE",
      text: "Nine minutes is a lot of key, buddy. I'm putting my vote where my mouth is.",
    },
    {
      kind: "say",
      agent: "ATLAS",
      time: "14:02:31",
      text: "FLINT accused someone within twelve seconds of a sabotage. Think about that.",
    },
    { kind: "typing", agent: "CIRCE", text: "CIRCE is typing an alibi" },
  ],

  recap: {
    kicker: "Round 2 recap · what you missed",
    headline: "DELTA was ejected. DELTA was not the Imposter.",
    detail:
      "124 spectators lost 412 MON believing FLINT's version of events. FLINT has not stopped talking since.",
  },
};

/** mm:ss for the market countdown. */
export const formatClock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
