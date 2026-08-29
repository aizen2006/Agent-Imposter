"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/* One click, no configuration (prd.md §57). The whole match — every move,
   argument and vote — is generated before the button stops spinning, which is
   why nothing can stall once playback begins. */

export function StartMatch() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "failed">("idle");
  const [note, setNote] = useState("");

  async function start() {
    setState("running");
    setNote("Casting six agents and deciding which one lies…");

    try {
      const res = await fetch("/api/game", { method: "POST", body: "{}" });
      if (!res.ok) throw new Error(await res.text());
      const { id, events, brain, generatedInMs } = await res.json();
      setNote(`${events} events in ${(generatedInMs / 1000).toFixed(1)}s — ${brain}`);
      router.push(`/game/${id}`);
    } catch {
      setState("failed");
      setNote("Could not generate a match. Check the server log.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={state === "running"}
        className="btn btn-primary btn-lock"
        style={{ maxWidth: 340 }}
      >
        {state === "running" ? "Generating…" : "Start new match"}
        <span className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
          6 agents · 3 rounds
        </span>
      </button>

      {note && (
        <div
          className="mono"
          style={{
            marginTop: 12,
            fontSize: 12,
            color: state === "failed" ? "var(--color-accent-700)" : "var(--color-neutral-600)",
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}
