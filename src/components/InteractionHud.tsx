import { Button } from "@/components/ui/button";
import type { NearbyInteraction } from "@/game/interactions";

type Props = {
  nearby: NearbyInteraction | null;
  dialogue: NearbyInteraction | null;
  machinesRunning: boolean;
  actionDisabled?: boolean;
  onInteract: () => void;
  onAction: () => void;
  onClose: () => void;
};

export function InteractionHud({
  nearby,
  dialogue,
  machinesRunning,
  actionDisabled = false,
  onInteract,
  onAction,
  onClose,
}: Props) {
  if (dialogue) {
    return (
      <section
        aria-live="polite"
        className="fixed bottom-24 left-1/2 z-[80] w-[min(92vw,440px)] -translate-x-1/2 animate-scale-in rounded-lg bg-background/95 p-3 text-foreground shadow-2xl ring-1 ring-border backdrop-blur"
      >
        <div className="flex items-start gap-3">
          <span aria-hidden className="text-3xl">{dialogue.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">{dialogue.title}</p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">
              {dialogue.dialogue}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer le dialogue">
            ✕
          </Button>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {dialogue.kind === "carWash" ? (
            <Button onClick={onAction} className="bg-splash text-splash-foreground">
              {machinesRunning ? "Voir les machines" : "Tout démarrer"}
            </Button>
          ) : dialogue.kind === "house" ? (
            <Button onClick={onAction} className="bg-sunny text-sunny-foreground">👋 Saluer</Button>
          ) : dialogue.kind === "vendor" ? (
            <Button disabled={actionDisabled} onClick={onAction} className="bg-sunny text-sunny-foreground">
              🔧 Acheter et réparer · {dialogue.price} €
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>Continuer</Button>
        </div>
      </section>
    );
  }

  if (!nearby) return null;
  return (
    <Button
      onClick={onInteract}
      className="fixed bottom-36 right-4 z-[70] h-14 min-w-14 animate-fade-in gap-2 rounded-full bg-foreground px-3 text-background shadow-xl sm:bottom-24 sm:left-1/2 sm:right-auto sm:h-auto sm:-translate-x-1/2 sm:px-4 sm:py-3"
      aria-label={`${nearby.prompt} avec ${nearby.title}`}
    >
      <span aria-hidden>{nearby.icon}</span>
      <span className="hidden sm:inline">{nearby.prompt}</span>
      <kbd className="grid size-7 place-items-center rounded-full bg-background/15 text-xs font-black">E</kbd>
    </Button>
  );
}