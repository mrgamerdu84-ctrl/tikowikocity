import { Button } from "@/components/ui/button";
import { effectiveWashDuration, paymentPreview } from "@/game/clientBehavior";
import { washAverages, type WashMetrics } from "@/game/metrics";
import { PART_GRADE_META, rollerQualityFactor, type RollerPartGrade } from "@/game/spareParts";
import { queueCapacity, UPGRADES, type UpgradeLevels } from "@/game/upgrades";
import type { ClientBehavior } from "@/game/clientBehavior";
import type { UrbanEvent } from "@/game/urbanEvents";
import { eventSatisfactionBonus, URBAN_EVENT_META } from "@/game/urbanEvents";

type Props = { open: boolean; metrics: WashMetrics; upgrades: UpgradeLevels; behavior: ClientBehavior; rollerCondition: number; partGrade: RollerPartGrade; event: UrbanEvent | null; onClose: () => void };

export function CarWashStatsMenu({ open, metrics, upgrades, behavior, rollerCondition, partGrade, event, onClose }: Props) {
  if (!open) return null;
  const averages = washAverages(metrics);
  const rollerQuality = rollerQualityFactor(rollerCondition);
  const payment = paymentPreview(upgrades, behavior, rollerQuality);
  const duration = effectiveWashDuration(upgrades, behavior);
  const predictedSatisfaction = Math.max(35, Math.min(100, Math.round(58 + rollerQuality * 28 + (upgrades.quality - 1) * 3 + (upgrades.decor - 1) * 2 + eventSatisfactionBonus(event))));
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="wash-stats-title" className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-background text-foreground shadow-2xl ring-1 ring-border">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2.5">
          <div className="min-w-0"><h2 id="wash-stats-title" className="truncate text-base font-extrabold">🫧 Car wash</h2><p className="truncate text-[11px] font-semibold text-muted-foreground">Performance réelle et influence des équipements</p></div>
          <Button variant="secondary" size="sm" onClick={onClose}>← Retour</Button>
        </header>
        <div className="overflow-y-auto p-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["REVENU/LAVAGE", `${metrics.count ? averages.revenue.toFixed(1) : ((payment[0] + payment[1]) / 2).toFixed(1)} €`], ["TEMPS MOYEN", `${metrics.count ? averages.duration.toFixed(1) : duration.toFixed(1)} s`], ["SATISFACTION", `${metrics.count ? Math.round(averages.satisfaction) : predictedSatisfaction} %`], ["PREMIUM", `${Math.round(averages.premiumRate)} %`]].map(([label, value]) => <div key={label} className="rounded-lg bg-muted/60 p-2 ring-1 ring-border"><dt className="text-[9px] font-bold text-muted-foreground">{label}</dt><dd className="mt-0.5 text-base font-black tabular-nums">{value}</dd></div>)}
          </dl>
          {event && <div className="mt-2 rounded-lg bg-sunny/20 px-3 py-2 text-xs font-bold ring-1 ring-sunny/30">{URBAN_EVENT_META[event.kind].icon} {event.title} · satisfaction {eventSatisfactionBonus(event) >= 0 ? "+" : ""}{eventSatisfactionBonus(event)} pts</div>}
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-xs font-extrabold"><span>Rouleaux niveau {upgrades.speed}</span><span className="ml-auto">{rollerCondition} %</span></div>
            <progress className="mt-1.5 h-2 w-full accent-splash" value={rollerCondition} max={100} />
            <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">{PART_GRADE_META[partGrade].label} · qualité réelle {Math.round(rollerQuality * 100)} % · {PART_GRADE_META[partGrade].wearPerWash} pts d’usure/lavage</p>
          </div>
          <div className="mt-3 divide-y divide-border rounded-lg border border-border">
            {UPGRADES.map((upgrade) => <div key={upgrade.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 px-3 py-2"><span aria-hidden>{upgrade.icon}</span><div className="min-w-0"><p className="text-xs font-extrabold">{upgrade.label} · niv. {upgrades[upgrade.key]}</p><p className="text-[10px] font-semibold text-muted-foreground">{upgrade.effect(upgrades[upgrade.key])}</p></div></div>)}
          </div>
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">Capacité actuelle : {queueCapacity(upgrades)} voitures · estimation tarifaire : {payment[0]}–{payment[1]} €.</p>
        </div>
      </section>
    </div>
  );
}
