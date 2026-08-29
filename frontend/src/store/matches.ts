import "server-only";

import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { del, list, put } from "@vercel/blob";
import type { Match } from "@/lib/match";

/* Shared match storage (prd.md §15.2).

   Until this existed every viewer generated a private match in their own tab,
   so two people on the site were betting into two different markets and the
   parimutuel pool had a population of one. This is what lets several people
   watch the same game — which is the entire premise.

   Frames are safe to publish: `Match` has no field that can hold imposterId
   (§6.3), so a public blob URL gives away nothing. The sealed ticket travels
   with them precisely so a match still resolves when its creator closes the
   tab; `revealAt` inside that ticket is what stops anyone triggering the
   reveal early.

   Two backends. Vercel Blob when a token is present, otherwise a directory on
   disk so the whole feature can be developed and demoed locally without
   provisioning anything. The filesystem one is not a deployment strategy —
   on Vercel each lambda gets its own /tmp, so sharing would silently not
   happen. That is why the token decides, not the environment.

   Best-effort throughout, exactly like the chain calls. No storage at all
   simply means a match plays for whoever generated it, which is the behaviour
   this replaces. Nothing here may take the game down. */

export type MatchMeta = {
  id: string;
  numericId: string;
  /** Chain height when the market opened — where §15.4 starts its log scan. */
  createdBlock: number;
  /** Wall clock at creation, so a late joiner can seek instead of restarting. */
  startedAt: number;
  durationMs: number;
};

export type StoredMatch = MatchMeta & {
  frames: Match[];
  durations: number[];
  /** Which gaps are held betting windows (engine/timing.ts). */
  pauseBefore?: number[];
  ticket: string | null;
};

const PREFIX = "matches/v1/";
const viaBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const dir = () => join(tmpdir(), "imposter-matches");

/* Metadata lives in the name so the lobby can list every match without
   downloading any of them — one round trip then answers "what is playing right
   now". Fetching 20 bodies to build a list page would be absurd. Fixed field
   order, id last because it is the only non-numeric part. */
const encode = (m: MatchMeta) =>
  `${m.startedAt}-${m.numericId}-${m.createdBlock}-${m.durationMs}-${m.id}.json`;

export function decode(name: string): MatchMeta | null {
  const base = name.replace(PREFIX, "").replace(/\.json$/, "");
  const parts = base.split("-");
  if (parts.length !== 5) return null;

  const [startedAt, numericId, createdBlock, durationMs, id] = parts;
  if (!/^\d+$/.test(startedAt) || !/^\d+$/.test(numericId)) return null;
  if (!/^\d+$/.test(createdBlock) || !/^\d+$/.test(durationMs)) return null;
  if (!/^[a-z0-9]+$/i.test(id)) return null;

  return {
    id,
    numericId,
    createdBlock: Number(createdBlock),
    startedAt: Number(startedAt),
    durationMs: Number(durationMs),
  };
}

/** Never throws. Returns the meta actually written, or null if storage failed. */
export async function putMatch(m: StoredMatch): Promise<MatchMeta | null> {
  const body = JSON.stringify(m);
  try {
    if (viaBlob()) {
      await put(PREFIX + encode(m), body, {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        // The name is derived from immutable facts, so a retry of the same
        // match should overwrite rather than 409.
        allowOverwrite: true,
        cacheControlMaxAge: 60 * 60 * 24,
      });
    } else {
      await mkdir(dir(), { recursive: true });
      await writeFile(join(dir(), encode(m)), body, "utf8");
    }
    return m;
  } catch (err) {
    console.warn(`[matches] put failed: ${short(err)} — match stays local`);
    return null;
  }
}

/** Newest first. Cheap: one listing, no bodies read. */
export async function listMatches(limit = 40): Promise<MatchMeta[]> {
  try {
    const names = viaBlob()
      ? (await list({ prefix: PREFIX, limit: 200 })).blobs.map((b) => b.pathname)
      : await readdir(dir()).catch(() => [] as string[]);

    return names
      .map(decode)
      .filter((m): m is MatchMeta => m !== null)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  } catch (err) {
    console.warn(`[matches] list failed: ${short(err)}`);
    return [];
  }
}

export async function getMatch(id: string): Promise<StoredMatch | null> {
  if (!/^[a-z0-9]+$/i.test(id)) return null;
  try {
    if (viaBlob()) {
      const { blobs } = await list({ prefix: PREFIX, limit: 200 });
      const hit = blobs.find((b) => decode(b.pathname)?.id === id);
      if (!hit) return null;
      const res = await fetch(hit.url, { cache: "no-store" });
      return res.ok ? ((await res.json()) as StoredMatch) : null;
    }

    const names = await readdir(dir()).catch(() => [] as string[]);
    const hit = names.find((n) => decode(n)?.id === id);
    if (!hit) return null;
    return JSON.parse(await readFile(join(dir(), hit), "utf8")) as StoredMatch;
  } catch (err) {
    console.warn(`[matches] get failed: ${short(err)}`);
    return null;
  }
}

/** Keeps the free tier irrelevant. Called opportunistically after a write. */
export async function sweep(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const stale = (m: MatchMeta | null) => (m ? m.startedAt < cutoff : true);

  try {
    if (viaBlob()) {
      const { blobs } = await list({ prefix: PREFIX, limit: 200 });
      const old = blobs.filter((b) => stale(decode(b.pathname)));
      if (old.length) await del(old.map((b) => b.url));
      return old.length;
    }

    const names = await readdir(dir()).catch(() => [] as string[]);
    const old = names.filter((n) => stale(decode(n)));
    await Promise.all(old.map((n) => unlink(join(dir(), n)).catch(() => {})));
    return old.length;
  } catch {
    return 0;
  }
}

const short = (err: unknown) =>
  err instanceof Error ? err.message.split("\n")[0] : String(err);
