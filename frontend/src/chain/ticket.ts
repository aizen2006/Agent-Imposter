import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { AgentIndex } from "@/engine/types";

/* The reveal ticket.

   Serverless has no shared memory: the lambda that generates a match is not
   the lambda that later reveals it, so the answer cannot simply be kept in a
   Map (prd.md §2.3 assumed one long-lived process). A database would work and
   is the wrong amount of machinery for this.

   Instead the server hands the browser a sealed blob containing the game id,
   the imposter and the salt, encrypted with a key only the server has. The
   browser stores it, plays the match, and hands it back at the end. It is
   ciphertext the whole way — the client cannot read what it is carrying, and
   §6.3 still holds.

   AES-256-GCM, so tampering fails authentication rather than decrypting to
   something attacker-chosen. A forged ticket cannot make resolve() lie: the
   contract still checks the commitment. */

type Payload = { g: string; i: AgentIndex; s: `0x${string}` };

/** Derived from RESOLVER_PK so there is no second secret to configure. If
    there is no resolver key there is no market, so there is nothing to seal. */
function key(): Buffer | null {
  const pk = process.env.RESOLVER_PK?.trim();
  if (!pk) return null;
  return createHash("sha256").update(`imposter-ticket:${pk}`).digest();
}

export function seal(gameId: bigint, imposterId: AgentIndex, salt: `0x${string}`): string | null {
  const k = key();
  if (!k) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const payload: Payload = { g: gameId.toString(), i: imposterId, s: salt };
  const body = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  // iv | tag | ciphertext, base64url so it survives a JSON round trip.
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** Returns null for anything that is not a ticket this server sealed. */
export function unseal(
  ticket: string,
): { gameId: bigint; imposterId: AgentIndex; salt: `0x${string}` } | null {
  const k = key();
  if (!k || typeof ticket !== "string" || ticket.length > 4096) return null;

  try {
    const raw = Buffer.from(ticket, "base64url");
    if (raw.length < 29) return null;

    const decipher = createDecipheriv("aes-256-gcm", k, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString("utf8");

    const p = JSON.parse(json) as Payload;
    if (typeof p.g !== "string" || typeof p.i !== "number" || typeof p.s !== "string") return null;
    return { gameId: BigInt(p.g), imposterId: p.i, salt: p.s };
  } catch {
    return null; // bad tag, bad base64, bad JSON — all the same answer
  }
}
