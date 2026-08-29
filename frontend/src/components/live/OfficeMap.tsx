import { Crewmate, CrewmateGhost } from "@/components/Crewmate";
import { agent, type Room } from "@/lib/match";

const badgeClass = { accent: "badge-accent", soft: "badge-soft", ghost: "badge-ghost" };

function RoomCard({ room }: { room: Room }) {
  const state = room.state ?? "default";
  const interactive = state === "default";

  return (
    <div
      className={[
        "room",
        interactive && "room-interactive",
        state === "sabotage" && "room-sabotage room-interactive",
        state === "empty" && "room-empty",
        state === "ghost" && "room-ghost",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* the sabotage card carries a bleed of accent in the corner */}
      {state === "sabotage" && (
        <div
          style={{
            position: "absolute",
            right: -16,
            top: -16,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--color-accent)",
            opacity: 0.14,
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          className="kicker"
          style={state === "sabotage" ? { color: "var(--color-accent-700)" } : undefined}
        >
          {room.name}
        </span>
        {room.badge && (
          <span
            className={`badge ${badgeClass[room.badge.tone]}`}
            style={
              room.badge.tone === "accent"
                ? { animation: "pulseDot 1.6s ease-in-out infinite" }
                : undefined
            }
          >
            {room.badge.label}
          </span>
        )}
        {room.count !== undefined && !room.badge && (
          <span className="mono" style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>
            {room.count}
          </span>
        )}
      </div>

      {room.meta && (
        <div
          className="mono"
          style={{ fontSize: 10, color: "var(--color-accent-700)", marginTop: 5 }}
        >
          {room.meta}
        </div>
      )}

      {room.occupants.length === 0 ? (
        <div style={{ marginTop: "auto", fontSize: 11, color: "var(--color-neutral-500)" }}>
          {room.note}
        </div>
      ) : (
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
          }}
        >
          {room.occupants.map((o) => {
            const a = agent(o.agent);
            return a.alive ? (
              <Crewmate
                key={o.agent}
                hue={a.hue}
                badge={a.tag}
                badgeAccent={state === "sabotage" || o.accused}
                accused={o.accused}
                motion={o.motion ?? "bob"}
                duration={o.duration}
                delay={o.delay}
              />
            ) : (
              <CrewmateGhost key={o.agent} />
            );
          })}

          {room.occupants.some((o) => o.says) && (
            <div
              className="bubble"
              style={{
                maxWidth: 150,
                color: state === "sabotage" ? "var(--color-accent-800)" : undefined,
              }}
            >
              {room.occupants.find((o) => o.says)?.says}
            </div>
          )}

          {!room.occupants.some((o) => o.says) && room.note && (
            <div
              style={{
                fontSize: 11,
                color:
                  state === "ghost"
                    ? "var(--color-neutral-600)"
                    : "var(--color-neutral-700)",
              }}
            >
              {room.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OfficeMap({ rooms }: { rooms: Room[] }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 17 }}>The office · floor 2</h4>
        <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
          hover a room to see what happened there
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {rooms.map((room) => (
          <RoomCard key={room.name} room={room} />
        ))}
      </div>
    </>
  );
}
