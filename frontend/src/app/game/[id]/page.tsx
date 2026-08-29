import { LiveMatch } from "@/components/live/LiveMatch";
import { demoMatch } from "@/lib/match";

export default async function GamePage({ params }: PageProps<"/game/[id]">) {
  await params; // the engine will key off this once simulate.ts lands
  return <LiveMatch match={demoMatch} />;
}
