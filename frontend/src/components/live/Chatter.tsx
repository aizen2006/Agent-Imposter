"use client";

import { useState } from "react";
import { CrewBlob } from "@/components/Crewmate";
import { agent, type ChatLine } from "@/lib/match";

export function Chatter({ lines }: { lines: ChatLine[] }) {
  const [tab, setTab] = useState<"all" | "accusations">("all");
  const shown =
    tab === "all" ? lines : lines.filter((l) => l.kind === "say" && l.accuses);

  return (
    <div style={{ padding: "18px 20px 12px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 17 }}>Chatter</h4>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 4,
            padding: 3,
            borderRadius: "var(--radius-pill)",
            background: "var(--color-surface)",
          }}
        >
          <button
            type="button"
            className={`seg-tab ${tab === "all" ? "seg-tab-active" : ""}`}
            style={{ border: 0 }}
            onClick={() => setTab("all")}
          >
            All
          </button>
          <button
            type="button"
            className={`seg-tab ${tab === "accusations" ? "seg-tab-active" : ""}`}
            style={{ border: 0, background: tab === "accusations" ? undefined : "transparent" }}
            onClick={() => setTab("accusations")}
          >
            Accusations
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {shown.map((line, i) => {
          if (line.kind === "system") {
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 14,
                  background: "var(--color-accent)",
                  color: "var(--color-bg)",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--color-bg)",
                    animation: "pulseDot 1.2s linear infinite",
                    flex: "none",
                  }}
                />
                <span className="mono" style={{ fontSize: 11 }}>
                  {line.text}
                </span>
              </div>
            );
          }

          if (line.kind === "typing") {
            const a = agent(line.agent);
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <CrewBlob hue={a.hue} h={27} w={24} />
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    background: "var(--color-surface)",
                    borderRadius: "16px 16px 16px 5px",
                    padding: 12,
                  }}
                >
                  {[0, 0.2, 0.4].map((d) => (
                    <span
                      key={d}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--color-neutral-500)",
                        animation: "pulseDot 1s ease-in-out infinite",
                        animationDelay: `${d}s`,
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                  {line.text}
                </span>
              </div>
            );
          }

          const a = agent(line.agent);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-end",
                animation: "tickerIn 300ms var(--ease)",
              }}
            >
              <CrewBlob hue={a.hue} h={27} w={24} accused={Boolean(line.accuses)} />
              <div className={`chat-bubble ${line.accuses ? "chat-bubble-accused" : ""}`}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                    marginBottom: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 12 }}
                  >
                    {a.id}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 10, color: "var(--color-neutral-600)" }}
                  >
                    {line.time}
                    {line.where ? ` · ${line.where}` : ""}
                  </span>
                  {line.accuses && (
                    <span className="badge badge-accent">ACCUSES {line.accuses}</span>
                  )}
                </div>
                <div style={{ fontSize: 13.5 }}>{line.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
