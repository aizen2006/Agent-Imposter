/* Seeded PRNG (mulberry32). The whole simulation draws from one of these, so
   a given seed replays identically — which is the only practical way to debug
   a game that took 90 seconds of LLM calls to produce. */

export type Rng = {
  (): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  chance(p: number): boolean;
  /** Weighted pick. Weights need not sum to 1. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
};

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = next as Rng;

  rng.int = (maxExclusive) => Math.floor(next() * maxExclusive);
  rng.pick = (items) => items[Math.floor(next() * items.length)];
  rng.chance = (p) => next() < p;

  rng.shuffle = (items) => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  rng.weighted = (items, weight) => {
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    let roll = next() * total;
    for (const item of items) {
      roll -= weight(item);
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  };

  return rng;
}

/** Stable seed from a game id, so a replay link reproduces the match. */
export function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
