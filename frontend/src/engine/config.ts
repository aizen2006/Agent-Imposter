import type { AgentIndex, RoomId } from "./types";

/* ── The office ───────────────────────────────────────────────────────────
   Six rooms, hand-written adjacency, no pathfinding. An agent moves one room
   per action, so who could have been where is always readable from the log.

   This is the §3.2 graph with the shipped UI's names (prd.md §11.7).
   WHITEBOARD is the hub; KITCHEN and STANDUP are dead ends. */

export const ROOMS: RoomId[] = [
  "STANDUP",
  "SERVER_CLOSET",
  "KITCHEN",
  "WHITEBOARD",
  "PODS",
  "DEMO_STAGE",
];

export const ROOM_LABEL: Record<RoomId, string> = {
  STANDUP: "Standup Room",
  SERVER_CLOSET: "Server Closet",
  KITCHEN: "Kitchen",
  WHITEBOARD: "Whiteboard",
  PODS: "Pods",
  DEMO_STAGE: "Demo Stage",
};

export const ADJACENCY: Record<RoomId, RoomId[]> = {
  WHITEBOARD: ["DEMO_STAGE", "SERVER_CLOSET", "KITCHEN", "STANDUP", "PODS"],
  DEMO_STAGE: ["WHITEBOARD", "SERVER_CLOSET"],
  SERVER_CLOSET: ["WHITEBOARD", "DEMO_STAGE", "PODS"],
  PODS: ["SERVER_CLOSET", "WHITEBOARD"],
  KITCHEN: ["WHITEBOARD"],
  STANDUP: ["WHITEBOARD"],
};

/** Meetings pull every survivor here. */
export const MEETING_ROOM: RoomId = "STANDUP";

/** Verifies ADJACENCY is symmetric — a one-way door would silently strand agents. */
export function assertGraphSymmetric(): void {
  for (const room of ROOMS) {
    for (const neighbour of ADJACENCY[room]) {
      if (!ADJACENCY[neighbour].includes(room)) {
        throw new Error(`ADJACENCY not symmetric: ${room} → ${neighbour}`);
      }
    }
  }
}

/* ── The crew ─────────────────────────────────────────────────────────────
   INDEX ORDER IS FIXED. It is the agentId `bet()` takes on-chain and it
   matches lib/match.ts. Reordering this silently repoints every open bet. */

export const ROSTER: { index: AgentIndex; name: string }[] = [
  { index: 0, name: "ATLAS" },
  { index: 1, name: "BYTE" },
  { index: 2, name: "CIRCE" },
  { index: 3, name: "DELTA" },
  { index: 4, name: "ECHO" },
  { index: 5, name: "FLINT" },
];

export const byName = (name: string) =>
  ROSTER.find((a) => a.name === name.toUpperCase().trim());

/* ── Work ─────────────────────────────────────────────────────────────────
   Tasks exist to give agents a reason to move and a thing to be seen doing.
   They gate nothing (prd.md §3) — they are evidence generation. */

export const TASKS: Record<RoomId, string[]> = {
  STANDUP: ["sync the standup notes", "update the burndown"],
  SERVER_CLOSET: ["restart the build runner", "rotate the API keys"],
  KITCHEN: ["restock the coffee", "clear the sink"],
  WHITEBOARD: ["redraw the architecture", "reprioritise the backlog"],
  PODS: ["clear the sleep queue", "reset a workstation"],
  DEMO_STAGE: ["rehearse the pitch", "check the projector"],
};

/** What breaks when the Imposter sabotages a given room. */
export const SABOTAGE: Record<RoomId, string> = {
  STANDUP: "meeting notes deleted",
  SERVER_CLOSET: "CI pipeline poisoned",
  KITCHEN: "coffee machine bricked",
  WHITEBOARD: "architecture diagram wiped",
  PODS: "workstations locked out",
  DEMO_STAGE: "demo build corrupted",
};

export const SCENARIO = "Ship it before dawn";

/* ── Pacing ───────────────────────────────────────────────────────────────
   The forced drama schedule (prd.md §3.3). The engine overrides a passive
   Imposter — the audience needs a body. */

export const TOTAL_ROUNDS = 3;
/** No kills in round 1: the audience does not know anyone's name yet. */
export const FIRST_KILL_ROUND = 2;
export const MAX_KILLS_PER_ROUND = 1;
