type Props = {
  active: boolean;
  onToggle: () => void;
  onZoom: (direction: 1 | -1) => void;
  onReset: () => void;
  onFocusWash: () => void;
};

/** Commandes d’exploration libre : zoom et recentrage, utilisables au doigt. */
export function CameraControlsHud({ active, onToggle, onZoom, onReset, onFocusWash }: Props) {
  return (
    <div className="pointer-events-none fixed right-2 top-[4.75rem] z-[70] flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className={`pointer-events-auto rounded-lg px-3 py-2 text-[11px] font-black shadow-lg ${active ? "bg-slate-900 text-white" : "bg-white/92 text-slate-900 ring-1 ring-slate-900/10"}`}
      >
        {active ? "🔭 Exploration libre" : "🔭 Explorer la ville"}
      </button>
      {active && (
        <div className="pointer-events-auto flex flex-col gap-1.5 rounded-lg bg-white/92 p-1.5 shadow-lg ring-1 ring-slate-900/10">
          <button type="button" onClick={() => onZoom(1)} aria-label="Zoomer" className="rounded-md bg-slate-100 px-3 py-2 text-sm font-black">＋</button>
          <button type="button" onClick={() => onZoom(-1)} aria-label="Dézoomer" className="rounded-md bg-slate-100 px-3 py-2 text-sm font-black">－</button>
          <button type="button" onClick={onFocusWash} aria-label="Revenir au car wash" className="rounded-md bg-sky-100 px-3 py-2 text-sm font-black">🫧</button>
          <button type="button" onClick={onReset} aria-label="Vue d’ensemble" className="rounded-md bg-slate-100 px-3 py-2 text-sm font-black">🗺️</button>
        </div>
      )}
      {active && (
        <p className="pointer-events-none max-w-[9.5rem] rounded-md bg-slate-900/80 px-2 py-1 text-right text-[10px] font-bold text-white">
          1 doigt déplace · 2 doigts tournent et zooment · flèches ou ZQSD au clavier
        </p>
      )}
    </div>
  );
}
