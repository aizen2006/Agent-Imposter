import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import { ROOM_LABEL } from "@/engine/config";
import { createStubBrain } from "@/engine/brain-stub";
import type { Rng } from "@/engine/rng";
import type {
  ActionContext,
  ActionType,
  Brain,
  Decision,
  MeetingContext,
} from "@/engine/types";
import { renderView } from "./memory";
import { CREW_BRIEF, IMPOSTER_BRIEF, personalityOf } from "./personalities";

/* LangChain + OpenAI implementation of the Brain interface.

   Two models on purpose. Action selection is a five-way choice nobody reads,
   so it runs on the small fast model — six of these fire in parallel every
   round and their latency is the whole generation budget. Meeting dialogue is
   the actual product and runs on the larger one.

   Every call is time-boxed and falls back to the stub. A model outage must
   degrade the writing, never stall the game. */

const ACTION_MODEL = process.env.OPENAI_ACTION_MODEL ?? "gpt-4o-mini";
const DIALOGUE_MODEL = process.env.OPENAI_DIALOGUE_MODEL ?? "gpt-4o";
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 8000);

const DecisionSchema = z.object({
  action: z.enum(["MOVE", "TASK", "WAIT", "FAKE_TASK", "SABOTAGE", "KILL"]),
  target: z
    .string()
    .nullable()
    .describe("Room id for MOVE, agent name for KILL, otherwise null"),
  say: z.string().max(140).describe("One short line said out loud. May be a lie."),
});

const StatementSchema = z.object({
  text: z.string().max(180).describe("One or two sentences, in character"),
  accuses: z
    .string()
    .nullable()
    .describe("Agent name if this line directly accuses someone, else null"),
});

const VoteSchema = z.object({
  target: z.string().nullable().describe("Agent name to eject, or null to abstain"),
  reason: z.string().max(120),
});

function models() {
  const common = { timeout: TIMEOUT_MS, maxRetries: 1 };
  return {
    action: new ChatOpenAI({ model: ACTION_MODEL, temperature: 0.8, ...common })
      .withStructuredOutput(DecisionSchema, { name: "decide" }),
    statement: new ChatOpenAI({ model: DIALOGUE_MODEL, temperature: 0.95, ...common })
      .withStructuredOutput(StatementSchema, { name: "speak" }),
    ballot: new ChatOpenAI({ model: ACTION_MODEL, temperature: 0.6, ...common })
      .withStructuredOutput(VoteSchema, { name: "vote" }),
  };
}

/** Hard ceiling around a call. LangChain's own timeout covers the HTTP request;
    this covers everything else, including a retry that decides to take its time. */
async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("llm-timeout")), ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer!);
  }
}

const brief = (role: string) => (role === "IMPOSTER" ? IMPOSTER_BRIEF : CREW_BRIEF);

const systemFor = (name: string, role: string) =>
  `${personalityOf(name)}\n\n${brief(role)}\n\n` +
  `You are one of six AI agents working in a hackathon office. Stay in character. ` +
  `Never mention that you are a language model, never break the fiction, and never state ` +
  `your own role explicitly.`;

export function createLangChainBrain(rng: Rng): Brain {
  const stub = createStubBrain(rng);
  const llm = models();

  /** Logged once per failure so a silently degraded game is still visible. */
  const fallback = (who: string, what: string, err: unknown) => {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[brain] ${what} failed for ${who} (${reason}) — using stub`);
  };

  return {
    async decide(ctx: ActionContext): Promise<Decision> {
      const optionList = ctx.options
        .map((o, i) => `${i + 1}. ${o.action}${o.target ? ` → ${o.target}` : ""} — ${o.label}`)
        .join("\n");

      const prompt = [
        `Round ${ctx.round}. You are in the ${ROOM_LABEL[ctx.self.room]}.`,
        ctx.roommates.length
          ? `Also here: ${ctx.roommates.join(", ")}.`
          : `You are alone in this room.`,
        ctx.adjacentSolo.length
          ? `Alone nearby: ${ctx.adjacentSolo
              .map((s) => `${s.agent} in the ${ROOM_LABEL[s.room]}`)
              .join("; ")}.`
          : ``,
        ``,
        `What you know:`,
        renderView(ctx.self, ctx.view),
        ``,
        `Your legal moves — pick exactly one and copy its action and target verbatim:`,
        optionList,
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const out = await withDeadline(
          llm.action.invoke([
            { role: "system", content: systemFor(ctx.self.name, ctx.self.role) },
            { role: "user", content: prompt },
          ]),
          TIMEOUT_MS,
        );
        return {
          action: out.action as ActionType,
          target: out.target,
          say: out.say,
        };
      } catch (err) {
        fallback(ctx.self.name, "decide", err);
        return stub.decide(ctx);
      }
    },

    async speak(ctx: MeetingContext) {
      const said = ctx.transcript.length
        ? ctx.transcript.map((l) => `${l.name}: "${l.text}"`).join("\n")
        : "You are speaking first.";

      const prompt = [
        `Round ${ctx.round} meeting. Still here: you, ${ctx.candidates.join(", ")}.`,
        ``,
        `What you know:`,
        renderView(ctx.self, ctx.view),
        ``,
        `Said in this meeting so far:`,
        said,
        ``,
        `Say one thing. Respond to what was actually said and cite something you actually`,
        `witnessed. Do not invent events. If you are accusing someone, name them.`,
      ].join("\n");

      try {
        const out = await withDeadline(
          llm.statement.invoke([
            { role: "system", content: systemFor(ctx.self.name, ctx.self.role) },
            { role: "user", content: prompt },
          ]),
          TIMEOUT_MS,
        );
        const accuses =
          out.accuses && ctx.candidates.includes(out.accuses.toUpperCase())
            ? out.accuses.toUpperCase()
            : null;
        return { text: out.text, accuses };
      } catch (err) {
        fallback(ctx.self.name, "speak", err);
        return stub.speak(ctx);
      }
    },

    async vote(ctx: MeetingContext) {
      const prompt = [
        `Round ${ctx.round}. Vote to eject one agent, or abstain.`,
        `Candidates: ${ctx.candidates.join(", ")}.`,
        ``,
        `What you know:`,
        renderView(ctx.self, ctx.view),
        ``,
        `This meeting:`,
        ctx.transcript.map((l) => `${l.name}: "${l.text}"`).join("\n"),
      ].join("\n");

      try {
        const out = await withDeadline(
          llm.ballot.invoke([
            { role: "system", content: systemFor(ctx.self.name, ctx.self.role) },
            { role: "user", content: prompt },
          ]),
          TIMEOUT_MS,
        );
        const target =
          out.target && ctx.candidates.includes(out.target.toUpperCase())
            ? out.target.toUpperCase()
            : null;
        return { target };
      } catch (err) {
        fallback(ctx.self.name, "vote", err);
        return stub.vote(ctx);
      }
    },
  };
}
