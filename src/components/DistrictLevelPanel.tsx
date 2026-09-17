import { DISTRICT_LEVELS, districtAt, districtDemandBonus, nextDistrictLevel, type DistrictSnapshot } from "@/game/districtLevels";

type Props = {
  level: number;
  money: number;
  snapshot: DistrictSnapshot;
  onUpgrade: () => void;
};

/** Paliers de croissance : coût, déblocages et bonus de fréquentation. */
export function DistrictLevelPanel({ level, money, snapshot, onUpgrade }: Props) {
  const current = districtAt(level);
  const progress = nextDistrictLevel(level, snapshot, money);

  return (
    <section className="mt-2 rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h3 className="truncate text-sm font-black">{current.icon} Niveau {current.level} · {current.title}</h3>
        <span className="shrink-0 text-[11px] font-bold text-slate-500">+{districtDemandBonus(level)} % clients</span>
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-600">{current.summary}</p>

      {progress ? (
        <div className="mt-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <p className="truncate text-xs font-black">Prochain · {progress.next.icon} {progress.next.title}</p>
            <span className="shrink-0 text-xs font-black tabular-nums">{progress.next.cost.toLocaleString("fr-FR")} €</span>
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-600">{progress.next.summary} · +{progress.next.demandBonus} % de fréquentation</p>
          {progress.missing.length > 0 && (
            <ul className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] font-bold text-slate-500">
              {progress.missing.map((item) => (
                <li key={item.label}>{item.label} {item.value}/{item.target}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onUpgrade}
            disabled={!progress.ready || !progress.affordable}
            className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-45"
          >
            {progress.ready ? (progress.affordable ? `🏗️ Ouvrir le niveau ${progress.next.level}` : "Solde insuffisant") : "Objectifs en cours"}
          </button>
        </div>
      ) : (
        <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
          Tous les niveaux du quartier sont ouverts.
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {DISTRICT_LEVELS.map((entry) => (
          <span
            key={entry.level}
            className={`rounded-md px-2 py-1 text-[10px] font-black ${entry.level <= level ? "bg-slate-900 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200"}`}
          >
            {entry.icon} {entry.level}
          </span>
        ))}
      </div>
    </section>
  );
}
