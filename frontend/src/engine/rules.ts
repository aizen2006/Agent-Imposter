import {
  ADJACENCY,
  FIRST_KILL_ROUND,
  MAX_KILLS_PER_ROUND,
  ROOM_LABEL,
  TASKS,
  byName,
} from "./config";
import type {
  AgentIndex,
  AgentState,
  Decision,
  LegalOption,
  RoomId,
} from "./types";

/* The engine is authoritative. The brain requests; this file decides whether
   the request is possible. An impossible request is silently downgraded to
   WAIT rather than rejected — the game must never stall on a bad decision. */

export type ValidatedAction =
  | { kind: "MOVE"; to: RoomId }
  | { kind: "TASK"; task: string }
  | { kind: "FAKE_TASK"; task: string }
  | { kind: "SABOTAGE" }
  | { kind: "KILL"; victim: AgentIndex }
  | { kind: "WAIT" };

export type RoundState = {
  round: number;
  killsThisRound: number;
  sabotagedThisRound: boolean;
};

export const alive = (agents: AgentState[]) => agents.filter((a) => a.alive);

export const aliveIn = (agents: AgentState[], room: RoomId) =>
  agents.filter((a) => a.alive && a.room === room);

/** The task offered by a room, or null once this agent has been here.
    Deterministic in the agent index so the same agent gets the same job. */
export function taskFor(self: AgentState): string | null {
  const pool = TASKS[self.room];
  if (!pool?.length) return null;
  return pool[(self.index + self.tasksDone) % pool.length];
}

/* ── Kill legality ────────────────────────────────────────────────────────
   prd.md §3: the Imposter and its target must be the ONLY two living agents
   in the room. This is what makes the map matter — a crowded room is safe,
   and being alone with someone is the whole tension of the game. */

export function killTargets(
  self: AgentState,
  agents: AgentState[],
  state: RoundState,
): AgentState[] {
  if (self.role !== "IMPOSTER") return [];
  if (state.round < FIRST_KILL_ROUND) return [];
  if (state.killsThisRound >= MAX_KILLS_PER_ROUND) return [];

  const here = aliveIn(agents, self.room);
  if (here.length !== 2) return [];

  return here.filter((a) => a.index !== self.index);
}

/* ── Legal options ────────────────────────────────────────────────────────
   Handed to the brain so it chooses from what is possible. In Stage 4 these
   labels are rendered straight into the prompt. */

export function legalActions(
  self: AgentState,
  agents: AgentState[],
  state: RoundState,
): LegalOption[] {
  const options: LegalOption[] = [];

  for (const room of ADJACENCY[self.room]) {
    options.push({
      action: "MOVE",
      target: room,
      label: `Walk to the ${ROOM_LABEL[room]}`,
    });
  }

  const task = taskFor(self);

  if (self.role === "CREW") {
    if (task) options.push({ action: "TASK", target: task, label: `Do the task: ${task}` });
  } else {
    if (task) {
      options.push({
        action: "FAKE_TASK",
        target: task,
        label: `Pretend to: ${task} (looks identical to real work)`,
      });
    }
    if (!state.sabotagedThisRound) {
      options.push({
        action: "SABOTAGE",
        target: null,
        label: `Sabotage the ${ROOM_LABEL[self.room]}`,
      });
    }
    for (const victim of killTargets(self, agents, state)) {
      options.push({
        action: "KILL",
        target: victim.name,
        label: `Eliminate ${victim.name} — you are alone together`,
      });
    }
  }

  options.push({ action: "WAIT", target: null, label: "Stay put and watch" });
  return options;
}

/* ── Validation ───────────────────────────────────────────────────────────
   Re-checks against live state rather than trusting the option list, because
   in Stage 4 the brain can return anything at all. */

export function validate(
  decision: Decision,
  self: AgentState,
  agents: AgentState[],
  state: RoundState,
): ValidatedAction {
  const wait: ValidatedAction = { kind: "WAIT" };
  const target = decision.target?.toString().trim() ?? "";

  switch (decision.action) {
    case "MOVE": {
      const to = target.toUpperCase() as RoomId;
      return ADJACENCY[self.room]?.includes(to) ? { kind: "MOVE", to } : wait;
    }

    case "TASK": {
      if (self.role !== "CREW") return wait;
      const task = taskFor(self);
      return task ? { kind: "TASK", task } : wait;
    }

    case "FAKE_TASK": {
      if (self.role !== "IMPOSTER") return wait;
      const task = taskFor(self);
      return task ? { kind: "FAKE_TASK", task } : wait;
    }

    case "SABOTAGE": {
      if (self.role !== "IMPOSTER" || state.sabotagedThisRound) return wait;
      return { kind: "SABOTAGE" };
    }

    case "KILL": {
      const legal = killTargets(self, agents, state);
      const named = byName(target);
      const victim = named && legal.find((a) => a.index === named.index);
      return victim ? { kind: "KILL", victim: victim.index } : wait;
    }

    default:
      return wait;
  }
}

/** Whoever walks in on an undiscovered body reports it — never the killer.
    A kill requires isolation, so immediately afterwards the killer is the only
    living agent in the room. Letting them report would make `finderId` a
    perfect tell: the finder would be the Imposter in every isolated kill, and
    a crew that noticed would solve the game on the first body. Instead the
    body waits until somebody else arrives. */
export function bodyFinder(
  agents: AgentState[],
  room: RoomId,
  killer: AgentIndex,
): AgentState | null {
  return aliveIn(agents, room).find((a) => a.index !== killer) ?? null;
}

/** Highest unique vote count wins. A tie eliminates nobody (prd.md §3). */
export function tally(votes: (AgentIndex | null)[]): {
  eliminated: AgentIndex | null;
  reason: "tie" | "abstained" | null;
} {
  const counts = new Map<AgentIndex, number>();
  for (const v of votes) {
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  if (counts.size === 0) return { eliminated: null, reason: "abstained" };

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
    return { eliminated: null, reason: "tie" };
  }
  return { eliminated: ranked[0][0], reason: null };
}
