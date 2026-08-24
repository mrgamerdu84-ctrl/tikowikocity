import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import "../src/styles.css";
import "../src/mobile.css";
import "../src/lib/runtime-visual-fix";
import "../src/lib/runtime-car-color-lock";
import "../src/lib/mobile-compat";
import "../src/lib/runtime-build-smooth";
import "../src/lib/runtime-game-ui";

import CarWashScene from "../src/components/CarWashScene";
import PlayerSetup from "../src/components/PlayerSetup";
import { usePlayer } from "../src/lib/player";

function MobileGame() {
  const { player, ready } = usePlayer();
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950">
      {ready && !player ? <PlayerSetup /> : null}
      {ready && player ? <CarWashScene /> : null}
      <Toaster position="top-center" richColors />
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("TikowikoCity: racine mobile introuvable");
createRoot(root).render(
  <React.StrictMode>
    <MobileGame />
  </React.StrictMode>,
);
