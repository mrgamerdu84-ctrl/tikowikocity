import { createFileRoute } from "@tanstack/react-router";

import CarWashScene from "@/components/CarWashScene";
import PlayerSetup from "@/components/PlayerSetup";
import { usePlayer } from "@/lib/player";


const TITLE = "TikowikoCarWash — station de lavage 3D interactive";
const DESCRIPTION =
  "TikowikoCarWash : une station de lavage auto en 3D. Envoyez des voitures dans le tunnel et regardez les brosses et la mousse faire briller la carrosserie.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { player, ready } = usePlayer();

  return (
    <main className="min-h-screen">
      <h1 className="sr-only">TikowikoCarWash</h1>
      {ready && !player ? <PlayerSetup /> : null}
      {ready && player ? <CarWashScene /> : null}
    </main>
  );
}
