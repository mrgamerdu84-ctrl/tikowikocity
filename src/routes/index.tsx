import { createFileRoute } from "@tanstack/react-router";

import CarWashScene from "@/components/CarWashScene";
import PlayerSetup from "@/components/PlayerSetup";
import { usePlayer } from "@/lib/player";


const TITLE = "TikowikoCity — monde du jeu TikowikoCarWash";
const DESCRIPTION =
  "TikowikoCity : le monde ouvert de TikowikoCarWash. Construisez votre ville autour du car wash, gérez le trafic et développez votre petite cité.";

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
      <h1 className="sr-only">TikowikoCity</h1>
      {ready && !player ? <PlayerSetup /> : null}
      {ready && player ? <CarWashScene /> : null}
    </main>
  );
}
