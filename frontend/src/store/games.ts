import { runGame } from "@/engine/simulate";
import type { Game } from "@/engine/types";

/* In-memory game store (prd.md §2.3). Games are ephemeral — a DB buys nothing
   in a six-hour build and costs schema, migrations and a connection string.

   Held on globalThis so Next's dev-mode module reloading does not drop games
   mid-playback, which otherwise 404s the stream the moment you edit a file. */

const store = ((globalThis as { __games?: Map<string, Game> }).__games ??= new Map<string, Game>());

/** Newest first, so a reload can find the match that is actually running. */
export function listGames(): Game[] {
  return [...store.values()].sort((a, b) => b.seed - a.seed);
}

export const getGame = (id: string) => store.get(id);

export async function createGame(opts: { llm?: boolean } = {}): Promise<Game> {
  const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // The LLM brain is loaded lazily so a stub-only run never pulls LangChain
  // into the bundle, and a missing API key degrades instead of throwing.
  let brain;
  if (opts.llm && process.env.OPENAI_API_KEY) {
    ({ createLangChainBrain: brain } = await import("@/agents/brain"));
  }

  const game = await runGame({ id, brain });
  store.set(id, game);

  // Keep the process from growing without bound over a long demo session.
  if (store.size > 20) {
    for (const key of [...store.keys()].slice(0, store.size - 20)) store.delete(key);
  }

  return game;
}
