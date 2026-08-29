import { AGENTS, type AgentId, type ChatLine, type Match, type MarketOutcome, type Room } from "@/lib/match";
import { ROOMS, ROOM_LABEL, ROSTER, TOTAL_ROUNDS } from "./config";
import type { AgentIndex, GameEvent, RoomId } from "./types";

/* The seam between engine and UI (prd.md §7.2).

   The engine emits a chronological log; the UI renders a snapshot. This is the
   pure fold from one to the other, and it is the only place the two shapes
   meet. Playback is therefore just an increasing `upto` — no incremental
   patching, no ordering bugs — and replay, scrubbing and the golden-game
   fallback all come free because they run this same function.

   REDACTION LIVES HERE. `Match` has no field that can hold `imposterId`, so
   the secret cannot cross the wire by forgetting a guard. The reveal arrives
   only when a RESOLVED event has actually been folded. */

const nameOf = (i: AgentIndex) => ROSTER[i].name as AgentId;

/** Synthetic wall clock so the transcript reads like a log. */
function clockAt(i: number): string {
  const t = 14 * 3600 + i * 7;
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export type ProjectOptions = {
  matchId?: number;
  /** Per-agent MON staked, indexed 0–5. Supplied from the contract in Stage 5. */
  pools?: number[];
  bettors?: number;
  spectators?: number;
  /** Seconds until the market closes. */
  closesIn?: number;
};

export function project(
  events: GameEvent[],
  upto: number = events.length,
  opts: ProjectOptions = {},
): Match {
  const seen = events.slice(0, Math.max(0, upto));

  const room = new Map<AgentIndex, RoomId>();
  const alive = new Map<AgentIndex, boolean>();
  const bodyAt = new Map<AgentIndex, RoomId>();
  const tasks = new Map<AgentIndex, number>();
  const accusedCount = new Map<AgentIndex, number>();
  const lastSaid = new Map<RoomId, { agent: AgentIndex; text: string }>();

  let scenario = "";
  let round = 0;
  let inMeeting = false;

  /* Held on an object rather than as `let x: T | null`: TypeScript does not
     track assignments made inside the forEach callback below, so a plain
     nullable local stays narrowed to `null` afterwards and every read of it
     collapses to `never`. */
  const latest: {
    sabotage: { room: RoomId; what: string; witnesses: number; at: string } | null;
    loudest: AgentIndex | null;
    accusedNow: AgentIndex | null;
    ejected: { agent: AgentIndex; role: string; round: number } | null;
    resolved: { imposterId: AgentIndex; crewWon: boolean } | null;
  } = { sabotage: null, loudest: null, accusedNow: null, ejected: null, resolved: null };

  const chatter: ChatLine[] = [];

  seen.forEach((e, i) => {
    if ("round" in e && e.round > round) round = e.round;

    switch (e.t) {
      case "GAME_STARTED":
        scenario = e.scenario;
        for (const a of e.lineup) {
          room.set(a.id, a.room);
          alive.set(a.id, true);
          tasks.set(a.id, 0);
        }
        break;

      case "AGENT_MOVED":
        room.set(e.agentId, e.to);
        break;

      case "TASK_DONE":
        tasks.set(e.agentId, (tasks.get(e.agentId) ?? 0) + 1);
        break;

      case "SABOTAGE":
        // Only the most recent sabotage is shown as live damage.
        latest.sabotage = {
          room: e.room,
          what: e.what,
          witnesses: e.witnesses,
          at: clockAt(i),
        };
        chatter.push({
          kind: "system",
          text: `SABOTAGE · ${e.what} · ${e.witnesses} witnesses`,
        });
        break;

      case "KILL":
        alive.set(e.victimId, false);
        bodyAt.set(e.victimId, e.room);
        break;

      case "BODY_FOUND":
        chatter.push({
          kind: "system",
          text: `${nameOf(e.victimId)} found in the ${ROOM_LABEL[e.room]} · reported by ${nameOf(e.finderId)}`,
        });
        break;

      case "MEETING_START":
        inMeeting = true;
        break;

      case "SAID": {
        if (!e.meeting) lastSaid.set(e.room, { agent: e.agentId, text: e.text });
        if (e.accuses !== undefined) {
          accusedCount.set(e.accuses, (accusedCount.get(e.accuses) ?? 0) + 1);
          latest.accusedNow = e.accuses;
          latest.loudest = e.agentId;
        }
        chatter.push({
          kind: "say",
          agent: nameOf(e.agentId),
          time: clockAt(i),
          where: e.meeting ? undefined : ROOM_LABEL[e.room].toUpperCase(),
          text: e.text,
          ...(e.accuses !== undefined ? { accuses: nameOf(e.accuses) } : {}),
        });
        break;
      }

      case "ELIMINATED":
        alive.set(e.agentId, false);
        bodyAt.delete(e.agentId);
        latest.ejected = { agent: e.agentId, role: e.role, round: e.round };
        inMeeting = false;
        break;

      case "NO_ELIMINATION":
        inMeeting = false;
        break;

      case "RESOLVED":
        latest.resolved = { imposterId: e.imposterId, crewWon: e.crewWon };
        break;
    }
  });

  /* ── agents ──────────────────────────────────────────────────────────── */

  const agents = ROSTER.map(({ index, name }) => {
    const base = AGENTS[name as AgentId];
    const isAlive = alive.get(index as AgentIndex) ?? true;
    const accusations = accusedCount.get(index as AgentIndex) ?? 0;
    const done = tasks.get(index as AgentIndex) ?? 0;

    return {
      ...base,
      alive: isAlive,
      flagged: isAlive && accusations > 0,
      flag:
        accusations > 1
          ? `${accusations} accusations`
          : accusations === 1
            ? "under suspicion"
            : done > 0
              ? `${done} tasks done`
              : base.trait,
    };
  });

  /* ── rooms ───────────────────────────────────────────────────────────── */

  const rooms: Room[] = ROOMS.map((id): Room => {
    const here = ROSTER.map((r) => r.index as AgentIndex).filter(
      (i) => (alive.get(i) ?? true) && room.get(i) === id,
    );
    const bodies = [...bodyAt.entries()].filter(([, r]) => r === id).map(([i]) => i);
    const bubble = lastSaid.get(id);
    const isSabotaged = latest.sabotage?.room === id;

    const occupants = [
      ...here.map((i, n) => ({
        agent: nameOf(i),
        motion: (isSabotaged ? "waddle" : "bob") as "bob" | "waddle",
        duration: 2.2 + ((i * 3 + n) % 7) * 0.2,
        delay: (n % 4) * 0.2,
        accused: latest.accusedNow === i,
        ...(bubble?.agent === i ? { says: `"${bubble.text}"` } : {}),
      })),
      ...bodies.map((i) => ({ agent: nameOf(i) })),
    ];

    if (isSabotaged) {
      return {
        name: ROOM_LABEL[id],
        state: "sabotage",
        badge: { label: "SABOTAGE", tone: "accent" },
        meta: `${latest.sabotage!.at} · ${latest.sabotage!.witnesses} witnesses`,
        occupants,
      };
    }

    if (bodies.length > 0) {
      return {
        name: ROOM_LABEL[id],
        state: "ghost",
        badge: { label: "GHOST", tone: "ghost" },
        occupants,
        note: `${bodies.map(nameOf).join(", ")} · not coming back`,
      };
    }

    if (occupants.length === 0) {
      return {
        name: ROOM_LABEL[id],
        state: "empty",
        occupants: [],
        note: inMeeting ? "Everyone's in standup." : "Empty.",
      };
    }

    const isLoudest = latest.loudest !== null && here.includes(latest.loudest);
    return {
      name: ROOM_LABEL[id],
      state: "default",
      occupants,
      ...(isLoudest
        ? { badge: { label: "LOUDEST", tone: "soft" as const } }
        : { count: here.length }),
    };
  });

  /* ── market ──────────────────────────────────────────────────────────────
     Shares come from the contract, not the engine — humans decide these. With
     no pools yet the market renders flat rather than faking activity. */

  const pools = opts.pools ?? new Array(ROSTER.length).fill(0);
  const total = pools.reduce((a, b) => a + b, 0);
  const live = agents.filter((a) => a.alive);

  const market: MarketOutcome[] = live
    .map((a): MarketOutcome => {
      const staked = pools[a.index] ?? 0;
      const share = total > 0 ? (staked / total) * 100 : 100 / live.length;
      return {
        agent: a.id,
        share: Math.round(share),
        odds: staked > 0 ? total / staked : live.length,
        note: noteFor(a.id, accusedCount, tasks),
        leading: false,
      };
    })
    .sort((x, y) => y.share - x.share);

  if (market.length > 0) market[0].leading = true;

  /* ── recap ───────────────────────────────────────────────────────────── */

  const recap = latest.resolved
    ? {
        kicker: "Final · the floor is clear",
        headline: `${nameOf(latest.resolved.imposterId)} was the Imposter.`,
        detail: latest.resolved.crewWon
          ? "The crew found them in time. Anyone who backed them collects."
          : "They shipped it. Everyone who backed anyone else is holding nothing.",
      }
    : latest.ejected
      ? {
          kicker: `Round ${latest.ejected.round} recap · what you missed`,
          headline: `${nameOf(latest.ejected.agent)} was ejected. ${
            latest.ejected.role === "IMPOSTER"
              ? `${nameOf(latest.ejected.agent)} WAS the Imposter.`
              : `${nameOf(latest.ejected.agent)} was not the Imposter.`
          }`,
          detail:
            latest.ejected.role === "IMPOSTER"
              ? "The crew got there. The market settles on that."
              : "One fewer honest agent, and whoever is lying is still in the room.",
        }
      : {
          kicker: `Round ${Math.max(1, round)} · in progress`,
          headline: `Six agents. One of them is lying.`,
          detail: "Nobody has been ejected yet. The market is open.",
        };

  return {
    id: opts.matchId ?? 0,
    title: scenario || "Ship it before dawn",
    round: Math.max(1, round),
    totalRounds: TOTAL_ROUNDS,
    aliveCount: live.length,
    spectators: opts.spectators ?? 0,
    closesIn: opts.closesIn ?? 0,
    poolMon: total,
    bettors: opts.bettors ?? 0,
    agents,
    rooms,
    market,
    // Newest last; the panel shows the tail.
    chatter: chatter.slice(-14),
    recap,
  };
}

/** A one-line reason the market might care about this agent. Public evidence only. */
function noteFor(
  id: AgentId,
  accusedCount: Map<AgentIndex, number>,
  tasks: Map<AgentIndex, number>,
): string {
  const index = AGENTS[id].index as AgentIndex;
  const accusations = accusedCount.get(index) ?? 0;
  const done = tasks.get(index) ?? 0;

  if (accusations > 1) return `${accusations} agents have named them`;
  if (accusations === 1) return "accused once, unresolved";
  if (done > 1) return `${done} tasks, all witnessed`;
  if (done === 1) return "one task, otherwise quiet";
  return "nothing on the record yet";
}
