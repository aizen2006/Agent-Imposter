/* Engine harness.
     bun src/engine/dev.ts [gameId]        one match, stub brain, no API calls
     bun src/engine/dev.ts [gameId] --llm  same, driven by LangChain + OpenAI
     bun src/engine/dev.ts --stats 300     drama statistics over many matches */

import { FIRST_KILL_ROUND, ROOM_LABEL, ROSTER } from "./config";
import { runGame } from "./simulate";
import type { GameEvent } from "./types";

const name = (i: number) => ROSTER[i]?.name ?? `#${i}`;

function line(e: GameEvent): string {
  const r = "round" in e && e.round ? `R${e.round}` : "  ";
  const pad = (s: string) => `${r}  ${s}`;

  switch (e.t) {
    case "GAME_STARTED":
      return pad(`▶  "${e.scenario}"`);
    case "AGENT_MOVED":
      return pad(`→  ${name(e.agentId)} walks to ${ROOM_LABEL[e.to]}`);
    case "TASK_DONE":
      return pad(`✓  ${name(e.agentId)} — ${e.task} (${ROOM_LABEL[e.room]})`);
    case "SABOTAGE":
      return pad(`🚨 SABOTAGE · ${e.what} · ${ROOM_LABEL[e.room]} · ${e.witnesses} witnesses`);
    case "KILL":
      return pad(`☠  ${name(e.victimId)} is gone — ${ROOM_LABEL[e.room]}`);
    case "BODY_FOUND":
      return pad(`!  ${name(e.finderId)} finds ${name(e.victimId)} in ${ROOM_LABEL[e.room]}`);
    case "MEETING_START":
      return pad(`──  MEETING  ${"─".repeat(40)}`);
    case "SAID":
      return pad(
        `${e.meeting ? "💬" : "  "} ${name(e.agentId)}: "${e.text}"` +
          (e.accuses !== undefined ? `   [accuses ${name(e.accuses)}]` : ""),
      );
    case "VOTE":
      return pad(`🗳  ${name(e.agentId)} → ${e.targetId === null ? "abstains" : name(e.targetId)}`);
    case "ELIMINATED":
      return pad(`⚖  ${name(e.agentId)} EJECTED — was ${e.role}`);
    case "NO_ELIMINATION":
      return pad(`⚖  nobody ejected (${e.reason})`);
    case "RESOLVED":
      return pad(
        `🎭 ${name(e.imposterId)} WAS THE IMPOSTER — ${e.crewWon ? "CREW WINS" : "IMPOSTER WINS"}`,
      );
  }
}

/** Runs many games and reports whether the forced-drama schedule holds.
    A game with no body is the one outcome the demo cannot survive, so the
    zero-kill number is split into the legitimate cause (crew ejected the
    Imposter in round 1, before kills unlock) and the real defect. */
async function stats(n: number) {
  let sabotages = 0;
  let kills = 0;
  let crewWins = 0;
  let zeroKill = 0;
  let zeroKillEarlyWin = 0;
  const lengths: number[] = [];

  for (let i = 0; i < n; i++) {
    const g = await runGame({ id: `stat-${i}` });
    const k = g.events.filter((e) => e.t === "KILL").length;
    sabotages += g.events.filter((e) => e.t === "SABOTAGE").length;
    kills += k;
    if (g.crewWon) crewWins++;
    lengths.push(g.events.length);

    if (k === 0) {
      zeroKill++;
      const ejected = g.events.find((e) => e.t === "ELIMINATED" && e.role === "IMPOSTER");
      if (ejected && ejected.round < FIRST_KILL_ROUND) zeroKillEarlyWin++;
    }
  }

  const defects = zeroKill - zeroKillEarlyWin;
  const pct = (x: number) => `${((x / n) * 100).toFixed(1)}%`;
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);

  console.log(`\n── ${n} games ─────────────────────────────`);
  console.log(`crew win rate     ${pct(crewWins)}`);
  console.log(`sabotages/game    ${(sabotages / n).toFixed(2)}`);
  console.log(`kills/game        ${(kills / n).toFixed(2)}`);
  console.log(`events/game       ${avg(lengths)}`);
  console.log(`zero-kill games   ${zeroKill}  (${pct(zeroKill)})`);
  console.log(`  ├ crew won R1   ${zeroKillEarlyWin}  legitimate — kills unlock in R${FIRST_KILL_ROUND}`);
  console.log(
    `  └ no opportunity ${defects}  (${pct(defects)}) ${defects / n > 0.08 ? "← §3.3 regression" : "✓ acceptable"}`,
  );
}

const args = process.argv.slice(2);
const statsFlag = args.indexOf("--stats");

if (statsFlag !== -1) {
  await stats(Number(args[statsFlag + 1] ?? 50));
} else {
  const useLlm = args.includes("--llm");
  const id = args.find((a) => !a.startsWith("--")) ?? "demo";

  let brain;
  if (useLlm) {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set — put it in frontend/.env.local");
      process.exit(1);
    }
    ({ createLangChainBrain: brain } = await import("@/agents/brain"));
    console.log(
      `using LangChain + OpenAI  (actions: ${process.env.OPENAI_ACTION_MODEL ?? "gpt-4o-mini"}, ` +
        `dialogue: ${process.env.OPENAI_DIALOGUE_MODEL ?? "gpt-4o"})`,
    );
  }

  const started = Date.now();
  const game = await runGame({ id, brain });
  const took = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    `\nGAME ${game.id}   seed ${game.seed}   ` +
      `${game.events.length} events   generated in ${took}s\n`,
  );
  for (const e of game.events) console.log(line(e));

  console.log(`\n── final ─────────────────────────────────`);
  for (const a of game.agents) {
    console.log(
      `  ${a.alive ? "●" : "✗"} ${a.name.padEnd(6)} ${a.role.padEnd(9)} ` +
        `${ROOM_LABEL[a.room].padEnd(14)} ${a.tasksDone} tasks`,
    );
  }
  console.log(`\n  imposter: ${name(game.imposterId)}   crew won: ${game.crewWon}\n`);
}
