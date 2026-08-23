import { createFileRoute } from "@tanstack/react-router";

import CarWashScene from "@/components/CarWashScene";
import PlayerSetup from "@/components/PlayerSetup";
import SecurityGate from "@/components/SecurityGate";
import { usePlayer } from "@/lib/player";
import { handleSecurityRequest } from "@/lib/security-proxy";

const TITLE = "TikowikoCity — gérez votre ville et son car wash";
const DESCRIPTION =
  "TikowikoCity : construisez votre ville, gérez le trafic et faites tourner votre station de lavage. Gagnez de l'argent à chaque lavage et améliorez votre car wash.";

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
  server: {
    handlers: {
      POST: async ({ request }) => {
        const response = await handleSecurityRequest(request);
        return (
          response ??
          new Response(JSON.stringify({ valid: false, unavailable: true }), {
            status: 404,
            headers: { "content-type": "application/json; charset=utf-8" },
          })
        );
      },
    },
  },
  component: Index,
});

function Index() {
  const { player, ready } = usePlayer();

  return (
    <SecurityGate>
      <main className="min-h-screen">
        <h1 className="sr-only">TikowikoCity</h1>
        {ready && !player ? <PlayerSetup /> : null}
        {ready && player ? <CarWashScene /> : null}
      </main>
    </SecurityGate>
  );
}
