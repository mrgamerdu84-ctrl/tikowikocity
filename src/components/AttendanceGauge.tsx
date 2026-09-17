import type { NeighborhoodDemand, TravelerDemand } from "@/game/clientBehavior";

type Props = {
  demand: NeighborhoodDemand;
  travelers: TravelerDemand;
  districtBonus: number;
  carsPerHour: number;
};

/** Jauge de fréquentation : effet immédiat de chaque construction sur les clients. */
export function AttendanceGauge({ demand, travelers, districtBonus, carsPerHour }: Props) {
  const total = demand.bonusPercent + travelers.bonusPercent + districtBonus;
  const fill = Math.min(100, Math.round((total / 200) * 100));
  const rows: Array<[string, number, string]> = [
    ["🏠 Maisons", demand.housesPercent, "bg-amber-400"],
    ["👥 Habitants", demand.residentsPercent, "bg-violet-400"],
    ["🛣️ Routes", demand.roadsPercent, "bg-slate-400"],
    ["🅿️ Parkings", demand.parkingPercent, "bg-sky-400"],
    ["🧭 Voyageurs", travelers.bonusPercent, "bg-emerald-400"],
    ["🏙️ Niveau de quartier", districtBonus, "bg-rose-400"],
  ];

  return (
    <section className="mt-2 rounded-lg bg-sky-50 p-2.5 ring-1 ring-sky-200">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h3 className="truncate text-sm font-black">📈 Fréquentation du car wash</h3>
        <span className="shrink-0 text-sm font-black tabular-nums text-sky-700">+{total} %</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-sky-200">
        <div className="h-full rounded-full bg-sky-500 transition-all duration-500" style={{ width: `${fill}%` }} />
      </div>
      <p className="mt-1 text-[11px] font-semibold text-sky-900">
        ≈ {carsPerHour} voitures/heure · {travelers.cleanCarSeekers} voyageurs cherchent un lavage
      </p>
      <dl className="mt-2 space-y-1">
        {rows.map(([label, value, color]) => (
          <div key={label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2">
            <dt className="truncate text-[11px] font-bold text-slate-600">{label}</dt>
            <dd className="h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value * 2)}%` }} />
            </dd>
            <dd className="text-[11px] font-black tabular-nums text-slate-700">+{value} %</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
