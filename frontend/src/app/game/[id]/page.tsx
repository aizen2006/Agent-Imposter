import { LiveGame } from "@/components/live/LiveGame";

export default async function GamePage({ params, searchParams }: PageProps<"/game/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const speed = Number(Array.isArray(q.speed) ? q.speed[0] : (q.speed ?? 1)) || 1;

  return <LiveGame id={id} speed={speed} />;
}
