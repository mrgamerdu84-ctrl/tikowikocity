import { useState } from "react";

import { avatarSrc, type Player } from "@/lib/player";

type Machines = {
  belt: boolean;
  rollers: boolean;
  brushes: boolean;
  traffic: boolean;
};

type Props = {
  player: Player | null;
  money: number;
  washes: number;
  residents: number;
  houses: number;
  capacity: number;
  machines: Machines;
  cinema: boolean;
  walking: boolean;
  rollerCondition: number;
  hidden?: boolean;
  onBuild: () => void;
  onShop: () => void;
  onHistory: () => void;
  onToggleMachine: (key: keyof Machines) => void;
  onCinema: () => void;
  onWalk: () => void;
};

export function GameDashboard({
  player,
  money,
  washes,
  residents,
  houses,
  capacity,
  machines,
  cinema,
  walking,
  rollerCondition,
  hidden = false,
  onBuild,
  onShop,
  onHistory,
  onToggleMachine,
  onCinema,
  onWalk,
}: Props) {
  const [open, setOpen] = useState(false);

  const fullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  };

  const openRentals = () => {
    window.dispatchEvent(new CustomEvent("tikowiko:rentals-open"));
    setOpen(false);
  };

  if (hidden) return null;

  return (
    <>
      <div className="fixed left-2 right-2 top-2 z-[60] flex items-center gap-2 rounded-2xl bg-white/92 px-2.5 py-2 text-slate-900 shadow-lg ring-1 ring-slate-900/10 backdrop-blur sm:left-4 sm:right-auto sm:w-[390px]">
        {player && (
          <img src={avatarSrc(player.avatarId)} alt="" className="size-8 shrink-0 rounded-full bg-white object-contain ring-1 ring-slate-900/10" />
        )}
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[12px] font-extrabold">TikowikoCity{player ? ` · ${player.name}` : ""}</p>
          <p className="text-[11px] font-semibold text-slate-600">💰 {money.toLocaleString("fr-FR")} € · 👥 {residents} · 🏠 {houses}</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="ml-auto shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-[12px] font-extrabold text-white active:scale-95">☰ Tableau</button>
      </div>

      <div className="fixed bottom-[max(env(safe-area-inset-bottom),0.5rem)] left-1/2 z-[60] flex -translate-x-1/2 gap-1.5 rounded-2xl bg-white/94 p-1.5 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
        <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-slate-100 px-3 py-2 text-[12px] font-extrabold text-slate-900">📊 Gestion</button>
        <button type="button" onClick={onWalk} className={`rounded-xl px-3 py-2 text-[12px] font-extrabold active:scale-95 ${walking ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-900"}`}>{walking ? "👟 Explorer" : "🚶 Marcher"}</button>
        <button type="button" onClick={onBuild} className="rounded-xl bg-sky-500 px-4 py-2 text-[12px] font-extrabold text-white shadow-sm active:scale-95">🏗️ Construire</button>
        <button type="button" onClick={fullscreen} className="rounded-xl bg-slate-100 px-3 py-2 text-[12px] font-extrabold text-slate-900">⛶</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-2 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-black">📊 Tableau de bord</h2>
                <p className="text-[11px] font-semibold text-slate-500">Ville, argent, car wash et construction au même endroit</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-full bg-slate-100 px-3 py-2 font-black">✕</button>
            </div>

            <div className="overflow-y-auto p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-[11px] font-bold text-emerald-700">ARGENT</p><p className="mt-1 text-lg font-black">{money.toLocaleString("fr-FR")} €</p></div>
                <div className="rounded-2xl bg-sky-50 p-3"><p className="text-[11px] font-bold text-sky-700">LAVAGES</p><p className="mt-1 text-lg font-black">🫧 {washes}</p></div>
                <div className="rounded-2xl bg-violet-50 p-3"><p className="text-[11px] font-bold text-violet-700">HABITANTS</p><p className="mt-1 text-lg font-black">👥 {residents}/{capacity}</p></div>
                <div className="rounded-2xl bg-amber-50 p-3"><p className="text-[11px] font-bold text-amber-700">MAISONS</p><p className="mt-1 text-lg font-black">🏠 {houses}</p></div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setOpen(false); onWalk(); }} className="rounded-2xl bg-emerald-500 p-4 text-left font-black text-white">🚶 {walking ? "Quitter la marche" : "Explorer à pied"}<br/><span className="text-xs font-semibold opacity-90">Parcourir les quartiers</span></button>
                <button type="button" onClick={() => { setOpen(false); onBuild(); }} className="rounded-2xl bg-sky-500 p-4 text-left font-black text-white">🏗️ Construction<br/><span className="text-xs font-semibold opacity-90">Routes, maisons, parcs, éclairage</span></button>
                <button type="button" onClick={() => { setOpen(false); onShop(); }} className="rounded-2xl bg-amber-400 p-4 text-left font-black text-slate-900">🛠️ Améliorations<br/><span className="text-xs font-semibold opacity-75">Station et clientèle</span></button>
                <button type="button" onClick={openRentals} className="rounded-2xl bg-violet-500 p-4 text-left font-black text-white">🏘️ Locations<br/><span className="text-xs font-semibold opacity-90">Loyers, impôts et besoins</span></button>
                <button type="button" onClick={() => { setOpen(false); onHistory(); }} className="rounded-2xl bg-emerald-500 p-4 text-left font-black text-white">🧾 Argent & historique<br/><span className="text-xs font-semibold opacity-90">Entrées et dépenses</span></button>
              </div>

              <div className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-2 flex items-center"><p className="text-sm font-black">⚙️ Car wash</p><span className="ml-auto text-[11px] font-bold text-slate-500">Rouleaux {rollerCondition} %</span></div>
                <progress className="mb-2 h-1.5 w-full accent-emerald-500" value={rollerCondition} max={100} aria-label="État des rouleaux" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ["belt", "🛤️ Tapis"],
                    ["rollers", "🌀 Rouleaux"],
                    ["brushes", "🧽 Brosses"],
                    ["traffic", "🚦 Trafic"],
                  ] as Array<[keyof Machines, string]>).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => onToggleMachine(key)} className={`rounded-xl px-3 py-2 text-[12px] font-extrabold ${machines[key] ? "bg-sky-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                      {label}<br/><span className="text-[10px]">{machines[key] ? "ON" : "OFF"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { onCinema(); setOpen(false); }} className="rounded-2xl bg-slate-900 px-3 py-3 text-[12px] font-extrabold text-white">🎥 {cinema ? "Vue libre" : "Vue cinéma"}</button>
                <button type="button" onClick={fullscreen} className="rounded-2xl bg-slate-200 px-3 py-3 text-[12px] font-extrabold">⛶ Plein écran</button>
              </div>

              <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">✅ Sauvegarde locale automatique. La partie et l’APK restent utilisables sans publication Lovable.</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
