import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_CLIENT_BEHAVIOR,
  effectiveArrivalInterval,
  effectiveWashDuration,
  neighborhoodDemand,
  paymentPreview,
  type ClientBehavior,
  type NeighborhoodStats,
} from "@/game/clientBehavior";
import { queueCapacity, type UpgradeLevels } from "@/game/upgrades";

type Props = {
  open: boolean;
  behavior: ClientBehavior;
  upgrades: UpgradeLevels;
  neighborhood: NeighborhoodStats;
  rollerQuality: number;
  onChange: (next: ClientBehavior) => void;
  onClose: () => void;
};

const rows: Array<{ key: keyof ClientBehavior; icon: string; label: string; min: number; max: number; step: number; hint: string }> = [
  { key: "frequency", icon: "🚗", label: "Fréquence", min: 50, max: 150, step: 10, hint: "Règle la fréquence d’arrivée des clients." },
  { key: "payment", icon: "💶", label: "Montant payé", min: 75, max: 150, step: 5, hint: "Multiplie le prix payé après les bonus." },
  { key: "washTime", icon: "⏱️", label: "Temps de lavage", min: 70, max: 140, step: 5, hint: "100 % est la durée normale ; plus haut signifie plus long." },
];

export function ClientsMenu({ open, behavior, upgrades, neighborhood, rollerQuality, onChange, onClose }: Props) {
  if (!open) return null;
  const arrival = effectiveArrivalInterval(upgrades, neighborhood, behavior);
  const district = neighborhoodDemand(neighborhood);
  const duration = effectiveWashDuration(upgrades, behavior);
  const payment = paymentPreview(upgrades, behavior, rollerQuality);
  const update = (key: keyof ClientBehavior, value: number) => onChange({ ...behavior, [key]: value });

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center">
      <section aria-modal="true" role="dialog" aria-labelledby="clients-title" className="flex max-h-[88vh] w-full max-w-[480px] flex-col overflow-hidden rounded-3xl bg-background text-foreground shadow-2xl ring-1 ring-border">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 id="clients-title" className="text-lg font-extrabold">👥 Clients</h2>
            <p className="text-xs font-semibold text-muted-foreground">Comportement et résultats réels</p>
          </div>
          <Button className="ml-auto" variant="ghost" size="icon" onClick={onClose} aria-label="Fermer le menu Clients">✕</Button>
        </header>

        <div className="overflow-y-auto p-4">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-splash/10 p-2 ring-1 ring-splash/20"><dt className="text-[10px] font-bold opacity-65">ARRIVÉES</dt><dd className="mt-1 text-sm font-black">{arrival[0].toFixed(1)}–{arrival[1].toFixed(1)} s</dd></div>
            <div className="rounded-lg bg-sunny/20 p-2 ring-1 ring-sunny/30"><dt className="text-[10px] font-bold opacity-65">PAIEMENT</dt><dd className="mt-1 text-sm font-black">{payment[0]}–{payment[1]} €</dd></div>
            <div className="rounded-lg bg-ink/5 p-2 ring-1 ring-border"><dt className="text-[10px] font-bold opacity-65">LAVAGE</dt><dd className="mt-1 text-sm font-black">{duration.toFixed(1)} s</dd></div>
          </dl>

          <div className="mt-4 rounded-lg bg-splash/10 p-3 ring-1 ring-splash/20">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold">🏙️ Attractivité du quartier</h3>
              <strong className="ml-auto text-sm text-splash">+{district.bonusPercent} % de clients</strong>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
              <span>🏠 {neighborhood.houses} bâtiments</span><span className="text-right">+{district.housesPercent} %</span>
              <span>🧍 {neighborhood.residents} habitants</span><span className="text-right">+{district.residentsPercent} %</span>
              <span>🛣️ {neighborhood.roads} routes</span><span className="text-right">+{district.roadsPercent} %</span>
              <span>🅿️ {neighborhood.parking} parkings</span><span className="text-right">+{district.parkingPercent} %</span>
            </div>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">Construire et accueillir des habitants réduit directement l’attente entre deux clients.</p>
          </div>

          <div className="mt-4 divide-y divide-border rounded-lg border border-border">
            {rows.map((row) => (
              <label key={row.key} className="block px-3 py-3">
                <span className="flex items-center gap-2 text-sm font-extrabold"><span aria-hidden>{row.icon}</span>{row.label}<output className="ml-auto tabular-nums">{behavior[row.key]} %</output></span>
                <Slider className="my-3" min={row.min} max={row.max} step={row.step} value={[behavior[row.key]]} onValueChange={([value]) => { if (value !== undefined) update(row.key, value); }} aria-label={row.label} />
                <span className="block text-[11px] font-medium text-muted-foreground">{row.hint}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-muted/55 p-3">
            <h3 className="text-sm font-extrabold">🛠️ Améliorations influentes</h3>
            <ul className="mt-2 space-y-1.5 text-xs font-semibold text-muted-foreground">
              <li>⚡ Rouleaux rapides niv. {upgrades.speed} : arrivées et lavage accélérés.</li>
              <li>🅿️ Parking niv. {upgrades.parking} : clients plus fréquents.</li>
              <li>✨ Qualité niv. {upgrades.quality} + 🎨 Décoration niv. {upgrades.decor} : montant augmenté.</li>
              <li>🧤 Équipe niv. {upgrades.crew} : chance de paiement premium doublé.</li>
              <li>🚗 File niv. {upgrades.capacity} : jusqu’à {queueCapacity(upgrades)} clients acceptés.</li>
            </ul>
          </div>

          <Button variant="secondary" className="mt-4 w-full" onClick={() => onChange(DEFAULT_CLIENT_BEHAVIOR)}>↺ Réglages équilibrés</Button>
        </div>
      </section>
    </div>
  );
}