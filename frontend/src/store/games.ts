import { runGame } from "@/engine/simulate";
import type { Game } from "@/engine/types";

/* Match generation. No store.

   There used to be an in-memory Map here (prd.md §2.3 — "a DB buys nothing in
   a six-hour build"). That reasoning holds for a single long-lived process and
   breaks completely on Vercel: the lambda that generates a match is not the
   lambda that streams it, so every playback request landed on an instance that
   had never heard of the game and 404'd.

   The fix was to stop needing the state at all. The route projects the whole
   match into redacted frames and hands them to the browser, which replays them
   locally — so nothing needs to be remembered between requests. */

export async function createGame(opts: { llm?: boolean } = {}): Promise<Game> {
  const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // The LLM brain is loaded lazily so a stub-only run never pulls LangChain
  // into the bundle, and a missing API key degrades instead of throwing.
  let brain;
  if (opts.llm && process.env.OPENAI_API_KEY) {
    ({ createLangChainBrain: brain } = await import("@/agents/brain"));
  }

  return runGame({ id, brain });
}
