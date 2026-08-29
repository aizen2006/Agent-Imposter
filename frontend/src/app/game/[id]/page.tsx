import { GoldenGame } from "@/components/live/GoldenGame";
import { LiveGame } from "@/components/live/LiveGame";

export default async function GamePage({ params, searchParams }: PageProps<"/game/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const speed = Number(Array.isArray(q.speed) ? q.speed[0] : (q.speed ?? 1)) || 1;

  /* The demo safety net (prd.md Stage 6). Two ways in, because under stage
     lights you want the short one: /game/golden is typeable, ?demo=golden
     works on any URL you already have open. */
  const demo = Array.isArray(q.demo) ? q.demo[0] : q.demo;
  if (id === "golden" || demo === "golden") return <GoldenGame speed={speed} />;

  return <LiveGame id={id} speed={speed} />;
}
