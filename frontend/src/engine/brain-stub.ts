import { ROOM_LABEL } from "./config";
import type { Rng } from "./rng";
import type {
  ActionContext,
  Brain,
  Decision,
  LegalOption,
  MeetingContext,
  RoomId,
} from "./types";

/* The stub brain. Picks a random legal action and speaks from a canned pool.
   It is written before any LLM exists so a complete game can be played and
   watched with zero AI, and it is NEVER deleted — in Stage 4 it becomes the
   fallback when a model call times out or fails to parse. A game must always
   finish. */

/** Enough voice to keep a stub game from reading as filler on stage. */
const VOICE: Record<string, { idle: string[]; meeting: string[]; accuse: string[] }> = {
  ATLAS: {
    idle: ["Handled.", "This is under control.", "I've already thought about this."],
    meeting: [
      "I've been visible the whole time. Ask anyone.",
      "Let's not overthink a fairly obvious situation.",
    ],
    accuse: ["It's {t}. I'd stake the demo on it.", "{t} has been off since round one."],
  },
  BYTE: {
    idle: ["…", "Almost done here.", "Nearly there."],
    meeting: [
      "I was working. Alone. That's usually how work goes.",
      "I don't have anything to add that the logs don't already say.",
    ],
    accuse: ["{t}. Check where they were.", "Look at {t}'s timing, not mine."],
  },
  CIRCE: {
    idle: ["Who else came through here?", "Where was everyone just now?"],
    meeting: [
      "Can someone account for the gap before the alarm?",
      "Why is nobody asking who was closest?",
    ],
    accuse: ["Why was {t} there, exactly?", "{t} still hasn't answered the question."],
  },
  DELTA: {
    idle: ["Well, something's broken.", "That's not supposed to do that."],
    meeting: [
      "Someone in this room is lying and it isn't me.",
      "We're running out of rounds to get this right.",
    ],
    accuse: ["It's {t}. Obviously.", "{t}. I'm not going to pretend otherwise."],
  },
  ECHO: {
    idle: ["Same as before. Same as before.", "Noted. Noted again."],
    meeting: [
      "I said this last round and I'll say it again.",
      "Nothing has changed since the last time we did this.",
    ],
    accuse: ["{t}. I said {t} before, too.", "Still {t}. It was always {t}."],
  },
  FLINT: {
    idle: ["Somebody's going to regret this.", "I'm watching all of you."],
    meeting: [
      "One of you is very comfortable right now and it shows.",
      "I'll say the thing everyone's thinking.",
    ],
    accuse: ["It's {t}! It's been {t} the whole time!", "Vote {t}. Do it now."],
  },
};

const fallback = {
  idle: ["Fine.", "Working on it."],
  meeting: ["I don't like any of this."],
  accuse: ["{t}, then."],
};

const voiceFor = (name: string) => VOICE[name] ?? fallback;

/** Higher weight = chosen more often. The dramatic verbs outrank walking so
    a stub game still produces a story; the forced schedule in simulate.ts is
    the backstop, not the only source of action.

    The Imposter is biased hard toward walking in on someone who is alone.
    Without this it wanders, never engineers an opportunity, and a fifth of
    games contain no body at all — the one thing the demo cannot lack. In
    Stage 4 the prompt asks for the same behaviour in words. */
function weightOf(option: LegalOption, ctx: ActionContext): number {
  switch (option.action) {
    case "KILL":
      return 14;
    case "SABOTAGE":
      return 7;
    case "TASK":
    case "FAKE_TASK":
      return 5;
    case "MOVE": {
      const hunting =
        ctx.self.role === "IMPOSTER" &&
        ctx.adjacentSolo.some((s) => s.room === option.target);
      return hunting ? 24 : 4;
    }
    case "WAIT":
      return 1;
  }
}

export function createStubBrain(rng: Rng): Brain {
  return {
    async decide(ctx: ActionContext): Promise<Decision> {
      const choice = rng.weighted(ctx.options, (o) => weightOf(o, ctx));
      const voice = voiceFor(ctx.self.name);

      let say: string;
      switch (choice.action) {
        case "MOVE":
          say = `Heading to the ${ROOM_LABEL[choice.target as RoomId]}.`;
          break;
        case "TASK":
        case "FAKE_TASK":
          say = `Going to ${choice.target}.`;
          break;
        case "SABOTAGE":
          say = rng.pick(voice.idle);
          break;
        case "KILL":
          say = rng.pick(voice.idle);
          break;
        default:
          say = rng.pick(voice.idle);
      }

      return { action: choice.action, target: choice.target, say };
    },

    async speak(ctx: MeetingContext) {
      const voice = voiceFor(ctx.self.name);

      // Accuse more readily as the game runs out of rounds.
      const willAccuse = ctx.candidates.length > 0 && rng.chance(0.35 + ctx.round * 0.15);
      if (!willAccuse) {
        return { text: rng.pick(voice.meeting), accuses: null };
      }

      const target = rng.pick(ctx.candidates);
      return { text: rng.pick(voice.accuse).replaceAll("{t}", target), accuses: target };
    },

    async vote(ctx: MeetingContext) {
      if (ctx.candidates.length === 0) return { target: null };

      // Vote with whoever this agent already accused this meeting, if anyone.
      const own = ctx.transcript.find((line) => line.name === ctx.self.name);
      const named = own && ctx.candidates.find((c) => own.text.includes(c));
      if (named && rng.chance(0.8)) return { target: named };

      // Otherwise abstain occasionally — abstentions create ties, and ties
      // are the rule that keeps a bad read from ending the game early.
      if (rng.chance(0.12)) return { target: null };
      return { target: rng.pick(ctx.candidates) };
    },
  };
}
