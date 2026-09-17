import { useState } from "react";

import { AttendanceGauge } from "@/components/AttendanceGauge";
import { DistrictLevelPanel } from "@/components/DistrictLevelPanel";
import type { NeighborhoodDemand, TravelerDemand } from "@/game/clientBehavior";
import { districtDemandBonus, type DistrictSnapshot } from "@/game/districtLevels";
import { avatarSrc, type Player } from "@/lib/player";
import { MIN_ROLLER_CONDITION, PART_GRADE_META, rollerQualityFactor, type RollerPartGrade } from "@/game/spareParts";

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
  rollerLevel: number;
  rollerPartGrade: RollerPartGrade;
  savedAt: string | null;
  activeEvent?: { icon: string; title: string; remaining: string } | null;
  hidden?: boolean;
  onBuild: () => void;
  onShop: () => void;
  onHistory: () => void;
  onClients: () => void;
  onCarWash: () => void;
  onSave: () => void;
  onLoad: () => void;
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
  rollerLevel,
  rollerPartGrade,
  hidden = false,
  onBuild,
  onShop,
  onHistory,
  onClients,
  onCarWash,
  onSave,
  onLoad,
  savedAt,
  activeEvent,
  onToggleMachine,
  onCinema,
  onWalk,
}: Props) {
  const [open, setOpen] = useState(false);
  const washQuality = Math.round(rollerQualityFactor(rollerCondition) * 100);
  const rollerStatus = rollerCondition <= MIN_ROLLER_CONDITION ? "Seuil critique" : rollerCondition < 65 ? "Entretien conseillé" : "Bon état";
  const rollerAccent = rollerCondition <= MIN_ROLLER_CONDITION ? "accent-red-500" : rollerCondition < 65 ? "accent-amber-500" : "accent-emerald-500";

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
          <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white text-slate-900 shadow-2xl">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-200 px-3 py-2.5">
              <div className="min-w-0">
                <h2 className="truncate text-base font-black">📊 Tableau de bord</h2>
                <p className="truncate text-[10px] font-semibold text-slate-500">Ville, argent et station</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black">← Retour</button>
            </div>

            <div className="overflow-y-auto p-3 sm:p-4">
              <div className="grid grid-cols-4 gap-1.5">
                <div className="rounded-lg bg-emerald-50 p-2"><p className="text-[9px] font-bold text-emerald-700">ARGENT</p><p className="text-sm font-black">{money.toLocaleString("fr-FR")} €</p></div>
                <div className="rounded-lg bg-sky-50 p-2"><p className="text-[9px] font-bold text-sky-700">LAVAGES</p><p className="text-sm font-black">{washes}</p></div>
                <div className="rounded-lg bg-violet-50 p-2"><p className="text-[9px] font-bold text-violet-700">HABITANTS</p><p className="text-sm font-black">{residents}/{capacity}</p></div>
                <div className="rounded-lg bg-amber-50 p-2"><p className="text-[9px] font-bold text-amber-700">MAISONS</p><p className="text-sm font-black">{houses}</p></div>
              </div>

              {activeEvent && <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold ring-1 ring-amber-200"><span>{activeEvent.icon}</span><span className="min-w-0 flex-1 truncate">{activeEvent.title}</span><span className="shrink-0 tabular-nums text-amber-700">{activeEvent.remaining}</span></div>}

              <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                <button type="button" onClick={() => { setOpen(false); onWalk(); }} className="rounded-lg bg-emerald-500 p-2.5 text-left font-black text-white">🚶 {walking ? "Quitter la marche" : "Explorer à pied"}</button>
                <button type="button" onClick={() => { setOpen(false); onBuild(); }} className="rounded-lg bg-sky-500 p-2.5 text-left font-black text-white">🏗️ Construction</button>
                <button type="button" onClick={() => { setOpen(false); onShop(); }} className="rounded-lg bg-amber-400 p-2.5 text-left font-black text-slate-900">🛠️ Améliorations</button>
                <button type="button" onClick={() => { setOpen(false); onClients(); }} className="rounded-lg bg-splash p-2.5 text-left font-black text-splash-foreground">👥 Clients</button>
                <button type="button" onClick={() => { setOpen(false); onCarWash(); }} className="rounded-lg bg-sky-700 p-2.5 text-left font-black text-white">🫧 Car wash</button>
                <button type="button" onClick={openRentals} className="rounded-lg bg-violet-500 p-2.5 text-left font-black text-white">🏘️ Locations</button>
                <button type="button" onClick={() => { setOpen(false); onHistory(); }} className="col-span-2 rounded-lg bg-emerald-600 p-2.5 text-left font-black text-white">🧾 Journal & rentabilité</button>
              </div>

              <div className="mt-2 rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200">
                <div className="flex items-center"><p className="text-sm font-black">⚙️ État des rouleaux</p><span className="ml-auto text-[11px] font-bold text-slate-500">Niveau {rollerLevel}</span></div>
                <div className="mt-2 flex items-center text-xs font-extrabold"><span>{rollerStatus}</span><span className="ml-auto tabular-nums">{rollerCondition} %</span></div>
                <progress className={`mt-1 h-2 w-full ${rollerAccent}`} value={rollerCondition} max={100} aria-label="État des rouleaux" />
                <div className="mb-3 mt-2 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
                  <span>{PART_GRADE_META[rollerPartGrade].label}</span><span className="text-right">Usure {PART_GRADE_META[rollerPartGrade].wearPerWash} pts/lavage</span>
                  <span>Seuil d’usure {MIN_ROLLER_CONDITION} %</span><span className="text-right">Qualité lavage {washQuality} %</span>
                </div>
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

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => { onCinema(); setOpen(false); }} className="rounded-2xl bg-slate-900 px-3 py-3 text-[12px] font-extrabold text-white">🎥 {cinema ? "Vue libre" : "Vue cinéma"}</button>
                <button type="button" onClick={fullscreen} className="rounded-2xl bg-slate-200 px-3 py-3 text-[12px] font-extrabold">⛶ Plein écran</button>
              </div>

              <div className="mt-2 rounded-lg bg-emerald-50 p-2.5 ring-1 ring-emerald-200">
                <div className="grid grid-cols-2 gap-1.5"><button type="button" onClick={onSave} className="rounded-lg bg-emerald-600 px-2 py-2 text-[11px] font-black text-white">💾 Sauvegarder maintenant</button><button type="button" onClick={onLoad} disabled={!savedAt} className="rounded-lg bg-white px-2 py-2 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200 disabled:opacity-50">📥 Charger la sauvegarde</button></div>
                <p className="mt-1.5 text-[10px] font-semibold text-emerald-800">{savedAt ? `Dernière sauvegarde : ${savedAt}` : "Aucune sauvegarde disponible"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
