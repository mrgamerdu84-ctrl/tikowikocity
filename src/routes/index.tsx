import { createFileRoute } from "@tanstack/react-router";

import CarWashScene from "@/components/CarWashScene";

const TITLE = "Le Car Wash 3D — station de lavage interactive";
const DESCRIPTION =
  "Une station de lavage auto en 3D : envoyez des voitures dans le tunnel, regardez les brosses et la mousse faire briller la carrosserie.";

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
  return (
    <main className="min-h-screen">
      <h1 className="sr-only">Le Car Wash 3D</h1>
      <CarWashScene />
    </main>
  );
}
