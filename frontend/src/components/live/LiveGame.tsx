"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LiveMatch } from "./LiveMatch";
import { demoMatch, type Match } from "@/lib/match";

/* Subscribes to the playback stream and re-renders on each projected snapshot.
   The component tree below is unchanged from the static build — only where its
   `Match` comes from is different, which is the whole point of the projection
   seam (prd.md §7.2). */

type Status = "connecting" | "live" | "done" | "error";

export function LiveGame({ id, speed = 1 }: { id: string; speed?: number }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const source = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/game/${id}/stream?speed=${speed}`);
    source.current = es;

    es.addEventListener("frame", (e) => {
      setMatch(JSON.parse((e as MessageEvent).data) as Match);
      setStatus("live");
    });

    es.addEventListener("done", () => {
      setStatus("done");
      es.close();
    });

    es.onerror = () => {
      // EventSource retries on its own; only surface a hard failure once the
      // browser has actually given up.
      if (es.readyState === EventSource.CLOSED) setStatus("error");
    };

    return () => es.close();
  }, [id, speed]);

  if (!match) return <Waiting status={status} />;

  return (
    <>
      <LiveMatch match={match} />
      {status === "done" && (
        <div style={{ textAlign: "center", paddingBottom: 48 }}>
          <Link href="/" className="btn btn-primary" style={{ padding: "12px 28px" }}>
            Run another match
          </Link>
        </div>
      )}
    </>
  );
}

/** The first frame is ~400ms away, so this is mostly for reconnects and errors. */
function Waiting({ status }: { status: Status }) {
  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 24px 64px", width: "100%" }}>
      <div
        style={{
          background: "var(--color-bg)",
          borderRadius: "var(--radius-shell)",
          boxShadow: "var(--shadow-shell)",
          padding: "80px 48px",
          textAlign: "center",
        }}
      >
        {status === "error" ? (
          <>
            <h3 style={{ margin: 0 }}>That match is gone.</h3>
            <p style={{ color: "var(--color-neutral-700)", marginTop: 8 }}>
              Games are held in memory and do not survive a server restart.
            </p>
            <Link
              href="/"
              className="btn btn-primary"
              style={{ marginTop: 16, padding: "12px 24px" }}
            >
              Start a new one
            </Link>
          </>
        ) : (
          <>
            <div
              style={{
                display: "inline-flex",
                gap: 6,
                marginBottom: 14,
              }}
            >
              {[0, 0.2, 0.4].map((d) => (
                <span
                  key={d}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "var(--color-accent)",
                    animation: "pulseDot 1s ease-in-out infinite",
                    animationDelay: `${d}s`,
                  }}
                />
              ))}
            </div>
            <h3 style={{ margin: 0 }}>Everyone is getting into position.</h3>
          </>
        )}
      </div>
    </div>
  );
}

/** Static fallback used by the golden-game demo path. */
export const staticMatch = demoMatch;
