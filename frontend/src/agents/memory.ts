import { ROOM_LABEL, ROSTER } from "@/engine/config";
import type { AgentIndex, AgentState, GameEvent, RoomId } from "@/engine/types";

/* The hidden-information rule, in one file (prd.md §6.2).

   An agent sees an event if it is public, or if it happened where that agent
   was standing at the time. Nothing else. Getting this wrong does not throw —
   it just quietly turns a deduction game into a game where everyone is
   omniscient and the arguments stop meaning anything. */

const PUBLIC = new Set<GameEvent["t"]>([
  "GAME_STARTED",
  "SABOTAGE", // an alarm goes off; the whole floor knows
  "BODY_FOUND",
  "MEETING_START",
  "VOTE",
  "ELIMINATED", // role IS revealed on ejection — that is the rule, not a leak
  "NO_ELIMINATION",
  // RESOLVED is deliberately absent. It names the Imposter, it only fires once
  // every agent has finished acting, and no living agent has any use for it.
]);

/** Replays the log to answer: where was each agent when event `i` fired? */
function positionsOverTime(events: GameEvent[]): Map<AgentIndex, RoomId>[] {
  const where = new Map<AgentIndex, RoomId>();
  const snapshots: Map<AgentIndex, RoomId>[] = [];

  for (const e of events) {
    if (e.t === "GAME_STARTED") {
      for (const a of e.lineup) where.set(a.id, a.room);
    }
    // Snapshot *before* applying a move, so an AGENT_MOVED is judged against
    // the room the mover was leaving as well as the one they entered.
    snapshots.push(new Map(where));
    if (e.t === "AGENT_MOVED") where.set(e.agentId, e.to);
  }

  return snapshots;
}

export function buildView(self: AgentState, events: GameEvent[]): GameEvent[] {
  const snapshots = positionsOverTime(events);

  return events.filter((e, i) => {
    if (PUBLIC.has(e.t)) return true;

    const myRoom = snapshots[i].get(self.index);

    switch (e.t) {
      // Movement is visible from either end of the doorway — you see who
      // walks in, and you see who walks out. This is the primary evidence
      // trail in the whole game.
      case "AGENT_MOVED":
        return e.agentId === self.index || e.from === myRoom || e.to === myRoom;

      case "TASK_DONE":
        return e.room === myRoom;

      case "SAID":
        return e.meeting || e.room === myRoom;

      // A kill happens in isolation by definition, so only the killer ever
      // witnesses it. Everyone else learns of it as a BODY_FOUND.
      case "KILL":
        return self.role === "IMPOSTER";

      default:
        return false;
    }
  });
}

/* ── Rendering ────────────────────────────────────────────────────────────
   The model gets a compact summary, never the raw log (prd.md §46). Long
   transcripts cost latency on every one of six parallel calls and make the
   model worse at the only question being asked. */

const nameOf = (i: AgentIndex) => ROSTER[i]?.name ?? `#${i}`;
const room = (r: RoomId) => ROOM_LABEL[r];

function describe(e: GameEvent, self: AgentState): string | null {
  const me = (i: AgentIndex) => (i === self.index ? "You" : nameOf(i));

  switch (e.t) {
    case "GAME_STARTED":
      return `The team is trying to ship "${e.scenario}".`;
    case "AGENT_MOVED":
      return `${me(e.agentId)} moved from the ${room(e.from)} to the ${room(e.to)}.`;
    case "TASK_DONE":
      return `${me(e.agentId)} worked on "${e.task}" in the ${room(e.room)}.`;
    case "SABOTAGE":
      return `SABOTAGE in the ${room(e.room)}: ${e.what}. ${e.witnesses} witnesses.`;
    case "KILL":
      return `You eliminated ${nameOf(e.victimId)} in the ${room(e.room)}.`;
    case "BODY_FOUND":
      return `${me(e.finderId)} found ${nameOf(e.victimId)} dead in the ${room(e.room)}.`;
    case "MEETING_START":
      return `— Meeting ${e.round} —`;
    case "SAID":
      return `${me(e.agentId)}: "${e.text}"`;
    case "VOTE":
      return `${me(e.agentId)} voted ${e.targetId === null ? "to abstain" : nameOf(e.targetId)}.`;
    case "ELIMINATED":
      return `${nameOf(e.agentId)} was ejected. They were ${e.role}.`;
    case "NO_ELIMINATION":
      return `Nobody was ejected (${e.reason}).`;
    case "RESOLVED":
      return null; // never reaches a living agent's prompt
  }
}

/** The last `limit` things this agent knows, oldest first. */
export function renderView(
  self: AgentState,
  events: GameEvent[],
  limit = 28,
): string {
  const lines = buildView(self, events)
    .map((e) => describe(e, self))
    .filter((l): l is string => l !== null);

  const tail = lines.slice(-limit);
  return tail.length ? tail.join("\n") : "Nothing has happened yet.";
}
