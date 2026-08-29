import {
  ADJACENCY,
  FIRST_KILL_ROUND,
  MEETING_ROOM,
  ROOMS,
  ROOM_LABEL,
  ROSTER,
  SABOTAGE,
  SCENARIO,
  TOTAL_ROUNDS,
  assertGraphSymmetric,
} from "./config";
import { makeRng, seedFrom, type Rng } from "./rng";
import {
  aliveIn,
  alive as aliveOf,
  bodyFinder,
  killTargets,
  legalActions,
  tally,
  validate,
  type RoundState,
} from "./rules";
import { createStubBrain } from "./brain-stub";
import type {
  ActionType,
  AgentIndex,
  AgentState,
  Brain,
  Game,
  GameEvent,
  RoomId,
} from "./types";

/* runGame() produces the entire match up front — every move, kill, argument
   and vote — as one append-only event log. Nothing is streamed here; playback
   is a separate concern (prd.md §2.1). That is what keeps a live demo off the
   critical path of an LLM call. */

export type RunOptions = {
  id: string;
  seed?: number;
  /** Defaults to the stub. Stage 4 passes the LLM brain. */
  brain?: (rng: Rng) => Brain;
};

export async function runGame({ id, seed, brain }: RunOptions): Promise<Game> {
  assertGraphSymmetric();

  const theSeed = seed ?? seedFrom(id);
  const rng = makeRng(theSeed);
  const mind = (brain ?? createStubBrain)(rng);

  const imposterId = rng.int(ROSTER.length) as AgentIndex;

  const agents: AgentState[] = ROSTER.map((a) => ({
    index: a.index,
    name: a.name,
    role: a.index === imposterId ? "IMPOSTER" : "CREW",
    room: rng.pick(ROOMS),
    alive: true,
    tasksDone: 0,
  }));

  const events: GameEvent[] = [];
  const emit = (e: GameEvent) => events.push(e);
  const imposter = () => agents[imposterId];

  /** Bodies waiting to be walked in on, and who left them there.
      The killer is excluded from finding them — see rules.bodyFinder. */
  const undiscovered = new Map<AgentIndex, { room: RoomId; killer: AgentIndex }>();

  emit({
    t: "GAME_STARTED",
    round: 0,
    scenario: SCENARIO,
    lineup: agents.map((a) => ({ id: a.index, name: a.name, room: a.room })),
  });

  let crewWon = false;
  let lastRound = 0;

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    lastRound = round;
    const state: RoundState = { round, killsThisRound: 0, sabotagedThisRound: false };

    /* ── Disperse ────────────────────────────────────────────────────────
       Everyone left the last meeting standing in one room. If they start the
       round that way they never separate, and "alone together" — the only
       condition under which a kill is legal — effectively never happens.
       Measured: without this, 74% of games contained no kill at all.
       So the crew goes back to work, spread across the floor. */

    if (round > 1) {
      const rooms = rng.shuffle(ROOMS);
      aliveOf(agents).forEach((a, i) => {
        const to = rooms[i % rooms.length];
        if (to === a.room) return;
        const from = a.room;
        a.room = to;
        emit({ t: "AGENT_MOVED", round, agentId: a.index, from, to });
      });
    }

    /* ── Action phase ────────────────────────────────────────────────────
       Every survivor decides simultaneously against the same snapshot, so
       Stage 4 can Promise.all these six model calls. Movement applies first,
       then everything else is re-validated against the moved board — a kill
       whose target walked away simply fails, and the forced-drama step below
       is the backstop. */

    const decisions = await Promise.all(
      aliveOf(agents).map(async (self) => ({
        self,
        decision: await mind.decide({
          self,
          round,
          view: events,
          options: legalActions(self, agents, state),
          roommates: aliveIn(agents, self.room)
            .filter((a) => a.index !== self.index)
            .map((a) => a.name),
          taskHere: null,
          adjacentSolo: ADJACENCY[self.room].flatMap((room) => {
            const here = aliveIn(agents, room);
            return here.length === 1 && here[0].index !== self.index
              ? [{ room, agent: here[0].name }]
              : [];
          }),
        }),
      })),
    );

    for (const { self, decision } of decisions) {
      if (decision.action !== "MOVE") continue;
      const move = validate(decision, self, agents, state);
      if (move.kind !== "MOVE") continue;
      const from = self.room;
      self.room = move.to;
      emit({ t: "AGENT_MOVED", round, agentId: self.index, from, to: move.to });
    }

    for (const { self, decision } of decisions) {
      if (decision.action === "MOVE" || !self.alive) continue;
      apply(self, decision.action, decision.target, state);
    }

    // Room chatter — sampled, not every agent every round, or the feed drowns.
    for (const { self, decision } of decisions) {
      if (self.alive && decision.say && rng.chance(0.55)) {
        emit({
          t: "SAID",
          round,
          agentId: self.index,
          text: decision.say,
          room: self.room,
          meeting: false,
        });
      }
    }

    /* ── Forced drama (prd.md §3.3) ──────────────────────────────────────
       The engine overrides a passive Imposter. A round that produces no
       story is worse than a round the model did not choose. */

    if (round === 1 && !state.sabotagedThisRound && imposter().alive) {
      sabotage(imposter(), state);
    }
    if (round >= FIRST_KILL_ROUND && state.killsThisRound === 0 && imposter().alive) {
      forceKill(state);
    }

    // Someone walking in on the body finds it mid-round — the dramatic case.
    for (const [victim, { room, killer }] of [...undiscovered]) {
      const finder = bodyFinder(agents, room, killer);
      if (!finder) continue;
      undiscovered.delete(victim);
      emit({ t: "BODY_FOUND", round, victimId: victim, room, finderId: finder.index });
    }

    /* ── Meeting ─────────────────────────────────────────────────────────
       Statements are sequential — each agent reads what was just said, which
       is the only reason the arguments hang together. Votes are parallel. */

    /* Roll call. Anyone who does not turn up is accounted for here, wherever
       they were left. Without this, most bodies are never found at all — the
       killer cannot report, and nobody reliably wanders into the right room
       before the game ends (measured: 86% of kills went undiscovered). The
       audience must always learn that someone is gone. */
    for (const [victim, { room, killer }] of [...undiscovered]) {
      const witnesses = aliveOf(agents).filter((a) => a.index !== killer);
      if (witnesses.length === 0) continue;
      undiscovered.delete(victim);
      emit({
        t: "BODY_FOUND",
        round,
        victimId: victim,
        room,
        finderId: rng.pick(witnesses).index,
      });
    }

    emit({ t: "MEETING_START", round });

    for (const a of aliveOf(agents)) {
      if (a.room === MEETING_ROOM) continue;
      const from = a.room;
      a.room = MEETING_ROOM;
      emit({ t: "AGENT_MOVED", round, agentId: a.index, from, to: MEETING_ROOM });
    }

    const survivors = aliveOf(agents);
    const transcript: { name: string; text: string }[] = [];
    const others = (self: AgentState) =>
      survivors.filter((a) => a.index !== self.index).map((a) => a.name);

    for (const self of survivors) {
      const { text, accuses } = await mind.speak({
        self,
        round,
        view: events,
        transcript,
        candidates: others(self),
      });
      transcript.push({ name: self.name, text });

      const accused = accuses ? agents.find((a) => a.name === accuses) : undefined;
      emit({
        t: "SAID",
        round,
        agentId: self.index,
        text,
        room: MEETING_ROOM,
        meeting: true,
        ...(accused ? { accuses: accused.index } : {}),
      });
    }

    const ballots = await Promise.all(
      survivors.map(async (self) => {
        const { target } = await mind.vote({
          self,
          round,
          view: events,
          transcript,
          candidates: others(self),
        });
        const picked = target ? agents.find((a) => a.name === target) : undefined;
        return { self, target: picked?.alive ? picked.index : null };
      }),
    );

    for (const b of ballots) {
      emit({ t: "VOTE", round, agentId: b.self.index, targetId: b.target });
    }

    const result = tally(ballots.map((b) => b.target));
    if (result.eliminated === null) {
      emit({ t: "NO_ELIMINATION", round, reason: result.reason ?? "tie" });
    } else {
      const out = agents[result.eliminated];
      out.alive = false;
      undiscovered.delete(out.index);
      // Role is revealed on ejection — for the crew and the audience alike.
      emit({ t: "ELIMINATED", round, agentId: out.index, role: out.role });

      if (out.role === "IMPOSTER") {
        crewWon = true;
        break;
      }
    }

    if (aliveOf(agents).length <= 2) break;
  }

  emit({ t: "RESOLVED", round: lastRound, imposterId, crewWon });

  return {
    id,
    numericId: BigInt(theSeed),
    seed: theSeed,
    scenario: SCENARIO,
    agents,
    events,
    imposterId,
    salt: randomSalt(),
    round: lastRound,
    finished: true,
    crewWon,
  };

  /* ── helpers ──────────────────────────────────────────────────────────── */

  function apply(
    self: AgentState,
    action: ActionType,
    target: string | null,
    state: RoundState,
  ) {
    const v = validate({ action, target, say: "" }, self, agents, state);

    switch (v.kind) {
      case "TASK":
        self.tasksDone++;
        emit({
          t: "TASK_DONE",
          round: state.round,
          agentId: self.index,
          room: self.room,
          task: v.task,
        });
        break;

      case "FAKE_TASK":
        // Emits an identical event. That is the entire point — a faked task
        // must be indistinguishable to every observer, the log included.
        emit({
          t: "TASK_DONE",
          round: state.round,
          agentId: self.index,
          room: self.room,
          task: v.task,
        });
        break;

      case "SABOTAGE":
        sabotage(self, state);
        break;

      case "KILL":
        kill(self, v.victim, state);
        break;

      default:
        break;
    }
  }

  /* The engine overriding a passive Imposter (prd.md §3.3).
     If a kill is already legal, take it. Otherwise walk the Imposter into an
     adjacent room holding exactly one crew member and take it there.

     The relocation is emitted as an ordinary AGENT_MOVED, so it is public
     evidence like any other move — the crew and the audience can both see who
     walked in on whom. The engine manufactures the opportunity, never a kill
     that breaks the alone-together rule. */
  function forceKill(state: RoundState) {
    const self = imposter();

    const direct = killTargets(self, agents, state);
    if (direct.length > 0) {
      kill(self, direct[0].index, state);
      return;
    }

    const reachable = ADJACENCY[self.room].filter(
      (room) => aliveIn(agents, room).length === 1,
    );
    if (reachable.length === 0) return;

    const to = rng.pick(reachable);
    const from = self.room;
    self.room = to;
    emit({ t: "AGENT_MOVED", round: state.round, agentId: self.index, from, to });

    const targets = killTargets(self, agents, state);
    if (targets.length > 0) kill(self, targets[0].index, state);
  }

  function sabotage(self: AgentState, state: RoundState) {
    state.sabotagedThisRound = true;
    emit({
      t: "SABOTAGE",
      round: state.round,
      room: self.room,
      what: SABOTAGE[self.room],
      witnesses: aliveIn(agents, self.room).length - 1,
    });
  }

  function kill(self: AgentState, victimIndex: AgentIndex, state: RoundState) {
    const victim = agents[victimIndex];
    victim.alive = false;
    state.killsThisRound++;
    undiscovered.set(victim.index, { room: victim.room, killer: self.index });
    // The killer is never named. Only the victim and the room are public.
    emit({
      t: "KILL",
      round: state.round,
      victimId: victim.index,
      room: victim.room,
    });
  }
}

function randomSalt(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const roomLabel = (r: RoomId) => ROOM_LABEL[r];
