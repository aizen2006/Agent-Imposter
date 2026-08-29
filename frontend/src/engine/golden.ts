/* Bakes the demo safety net (prd.md Stage 6).

     bun src/engine/golden.ts            20 candidates, stub brain
     bun src/engine/golden.ts 30 --llm   30 candidates, real dialogue

   Runs a batch of matches, scores them for how well they demo, and writes the
   best one to public/golden-game.json. That file is a plain event array, so
   the fallback path and the live path run the exact same projection — the
   safety net cannot drift from the product it is standing in for.

   Use --llm before presenting. A stub-brain golden game replays perfectly but
   argues in templates, and the argument is the thing you are demoing. */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runGame } from "./simulate";
import { planPlayback } from "./timing";
import { ROSTER } from "./config";
import type { Game, GameEvent } from "./types";

const OUT = resolve(import.meta.dirname, "../../public/golden-game.json");

type Scored = { game: Game; score: number; why: string[] };

/** What makes a match worth showing a room full of people.

    Deliberately not "the most dramatic game possible" — it is the most
    *representative* good game. A freak result that never happens again would
    misrepresent the product it is covering for. */
function score(game: Game): Scored {
  const events = game.events;
  const has = (t: GameEvent["t"]) => events.some((e) => e.t === t);
  const count = (t: GameEvent["t"]) => events.filter((e) => e.t === t).length;
  const why: string[] = [];
  let score = 0;

  const kills = count("KILL");
  if (kills === 0) return { game, score: -1, why: ["no kill — nothing happens"] };
  score += 30;
  why.push(`${kills} kill${kills > 1 ? "s" : ""}`);

  // A body nobody finds is a kill the audience never learns about.
  if (has("BODY_FOUND")) {
    score += 25;
    why.push("body discovered");
  }

  // The crew ejecting an innocent is the moment the audience realises the
  // agents can be wrong — it is what makes the betting feel live.
  const wrongful = events.filter(
    (e) => e.t === "ELIMINATED" && e.agentId !== game.imposterId,
  ).length;
  if (wrongful > 0) {
    score += 20 * Math.min(wrongful, 2);
    why.push(`${wrongful} wrongful ejection${wrongful > 1 ? "s" : ""}`);
  }

  // Going the distance beats a round-one landslide; the market needs time.
  const rounds = Math.max(...events.map((e) => ("round" in e && e.round) || 0));
  score += rounds * 8;
  why.push(`${rounds} rounds`);

  // Enough talking to show the agents reasoning, not so much it drags.
  const said = count("SAID");
  if (said >= 8 && said <= 24) {
    score += 15;
    why.push(`${said} lines of argument`);
  } else {
    why.push(`${said} lines (outside the sweet spot)`);
  }

  // Both outcomes demo fine, but the imposter winning lands better: the
  // audience has just watched the agents talk themselves into it.
  if (!game.crewWon) {
    score += 10;
    why.push("imposter wins");
  } else {
    why.push("crew wins");
  }

  const { totalMs } = planPlayback(events);
  const secs = Math.round(totalMs / 1000);
  if (secs > 150) {
    score -= (secs - 150) / 2; // a demo you have to talk over is too long
    why.push(`${secs}s — long`);
  } else {
    why.push(`${secs}s`);
  }

  return { game, score, why };
}

async function main() {
  const args = process.argv.slice(2);
  const llm = args.includes("--llm");
  const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);

  let brain;
  if (llm) {
    if (!process.env.OPENAI_API_KEY) {
      console.error("--llm needs OPENAI_API_KEY. Load .env.local first:");
      console.error("  bun --env-file=.env.local src/engine/golden.ts 12 --llm");
      process.exit(1);
    }
    ({ createLangChainBrain: brain } = await import("../agents/brain"));
  }

  console.log(`Generating ${n} candidates (${llm ? "openai" : "stub"} brain)…\n`);

  const scored: Scored[] = [];
  for (let i = 0; i < n; i++) {
    const game = await runGame({ id: `golden-${i}`, seed: 8000 + i, brain });
    const s = score(game);
    scored.push(s);
    process.stdout.write(
      `  ${String(i + 1).padStart(2)}/${n}  score ${String(Math.round(s.score)).padStart(4)}  ${s.why.join(" · ")}\n`,
    );
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 0) {
    console.error("\nNo candidate had a kill. Something is wrong with the engine.");
    process.exit(1);
  }

  const { game } = best;
  const { totalMs } = planPlayback(game.events);

  /* The event log goes out whole, imposter included. That is fine and it is
     the point: this file never touches the market. It is a recording with no
     money attached, served with betting disabled, so there is nothing to
     protect. The live path — where MON is at stake — still projects
     server-side and still never sends the log to a browser. */
  const payload = {
    note: "Demo safety net (prd.md Stage 6). Replayed client-side with betting disabled. Regenerate: bun --env-file=.env.local src/engine/golden.ts 12 --llm",
    generatedAt: new Date().toISOString(),
    brain: llm ? "openai" : "stub",
    seed: game.seed,
    imposter: ROSTER[game.imposterId].name,
    crewWon: game.crewWon,
    events: game.events,
    meta: {
      events: game.events.length,
      durationMs: Math.round(totalMs),
      score: Math.round(best.score),
      why: best.why,
    },
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(`\n★ picked seed ${game.seed} — ${best.why.join(" · ")}`);
  console.log(`  imposter was ${payload.imposter}, ${game.crewWon ? "crew" : "imposter"} won`);
  console.log(`  wrote ${OUT}`);
  console.log(`  ${game.events.length} events, ${Math.round(totalMs / 1000)}s playback`);
  console.log(`\n  Check it: bun run dev  →  http://localhost:3000/game/golden`);
}

main();
