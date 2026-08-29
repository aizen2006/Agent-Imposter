/* Verifies the hidden-information rule holds across many games.
   Run: bun src/agents/leak-check.ts [games]

   This needs no API key — it checks what the engine would put in front of a
   model, not what a model does with it. If any of these fail, the arguments in
   the meeting stop meaning anything, because everyone already knows. */

import { runGame } from "@/engine/simulate";
import { buildView, renderView } from "./memory";
import { ROSTER } from "@/engine/config";
import type { AgentIndex, GameEvent, RoomId } from "@/engine/types";

type Failure = { game: string; agent: string; rule: string; detail: string };

const failures: Failure[] = [];
const fail = (f: Failure) => failures.push(f);

const N = Number(process.argv[2] ?? 120);

for (let g = 0; g < N; g++) {
  const id = `leak-${g}`;
  const game = await runGame({ id });
  const imposterName = ROSTER[game.imposterId].name;

  // Reconstruct each agent's position at every index, independently of memory.ts,
  // so the check does not trust the code it is checking.
  const where = new Map<AgentIndex, RoomId>();
  const at: Map<AgentIndex, RoomId>[] = [];
  for (const e of game.events) {
    if (e.t === "GAME_STARTED") for (const a of e.lineup) where.set(a.id, a.room);
    at.push(new Map(where));
    if (e.t === "AGENT_MOVED") where.set(e.agentId, e.to);
  }

  for (const agent of game.agents) {
    const view = buildView(agent, game.events);
    const rendered = renderView(agent, game.events, 999);
    const seen = new Set<GameEvent>(view);

    // 1. Crew must never witness a kill.
    if (agent.role === "CREW") {
      for (const e of view) {
        if (e.t === "KILL") {
          fail({
            game: id,
            agent: agent.name,
            rule: "crew sees KILL",
            detail: `victim ${ROSTER[e.victimId].name}`,
          });
        }
      }
    }

    // 2. Nobody ever sees RESOLVED — it names the Imposter.
    if (view.some((e) => e.t === "RESOLVED")) {
      fail({ game: id, agent: agent.name, rule: "sees RESOLVED", detail: "" });
    }

    // 3. Room chatter is only audible in that room.
    game.events.forEach((e, i) => {
      if (e.t !== "SAID" || e.meeting) return;
      if (!seen.has(e)) return;
      const myRoom = at[i].get(agent.index);
      if (e.room !== myRoom && e.agentId !== agent.index) {
        fail({
          game: id,
          agent: agent.name,
          rule: "hears remote SAID",
          detail: `${e.room} while in ${myRoom}`,
        });
      }
    });

    // 4. Tasks are only visible in the room where they happened.
    game.events.forEach((e, i) => {
      if (e.t !== "TASK_DONE" || !seen.has(e)) return;
      const myRoom = at[i].get(agent.index);
      if (e.room !== myRoom) {
        fail({
          game: id,
          agent: agent.name,
          rule: "sees remote TASK_DONE",
          detail: `${e.room} while in ${myRoom}`,
        });
      }
    });

    // 5. The rendered prompt must never contain the word IMPOSTER attached to
    //    anyone but the reader — the one string that would end the game.
    if (agent.role === "CREW" && rendered.includes(imposterName)) {
      const lines = rendered.split("\n").filter((l) => l.includes("IMPOSTER"));
      for (const l of lines) {
        if (l.includes(imposterName) && !l.includes("was ejected")) {
          fail({ game: id, agent: agent.name, rule: "prompt names the Imposter", detail: l });
        }
      }
    }
  }
}

const byRule = new Map<string, number>();
for (const f of failures) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);

console.log(`\n── hidden-information check · ${N} games ──────────`);
if (failures.length === 0) {
  console.log("✓ no leaks");
  console.log("  crew never witness a kill");
  console.log("  RESOLVED never reaches an agent");
  console.log("  room chatter and tasks stay in their room");
} else {
  for (const [rule, n] of byRule) console.log(`✗ ${rule.padEnd(28)} ${n}`);
  console.log(`\nfirst 5:`);
  for (const f of failures.slice(0, 5)) {
    console.log(`  ${f.game} ${f.agent}: ${f.rule} ${f.detail}`);
  }
  process.exitCode = 1;
}
