import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallGameButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) setInstalled(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const result = await promptEvent.userChoice;
    if (result.outcome === "accepted") setPromptEvent(null);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Certains navigateurs intégrés bloquent le plein écran : le jeu reste utilisable.
    }
  };

  return (
    <div className="fixed bottom-3 right-3 z-[70] flex gap-2 sm:bottom-4 sm:right-4">
      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        className="rounded-full bg-white/90 px-3 py-2 text-[12px] font-extrabold text-slate-900 shadow-lg ring-1 ring-slate-900/10 backdrop-blur transition active:scale-95"
        aria-label={fullscreen ? "Quitter le plein écran" : "Agrandir le jeu en plein écran"}
      >
        {fullscreen ? "↙️ Réduire" : "⛶ Plein écran"}
      </button>

      {!installed && promptEvent && (
        <button
          type="button"
          onClick={() => void install()}
          className="rounded-full bg-sky-500 px-4 py-2 text-[12px] font-extrabold text-white shadow-lg ring-1 ring-sky-900/10 transition active:scale-95"
          aria-label="Installer TikowikoCity sur cet appareil"
        >
          ⬇️ Installer
        </button>
      )}
    </div>
  );
}
