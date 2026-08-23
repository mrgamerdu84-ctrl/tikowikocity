/* Boutique d'améliorations du car wash.
   Chaque amélioration a 5 niveaux ; le niveau 1 est l'état de départ. */

export type UpgradeKey = "capacity" | "speed" | "quality" | "parking" | "decor" | "crew";

export type UpgradeLevels = Record<UpgradeKey, number>;

export const MAX_LEVEL = 5;

export const DEFAULT_UPGRADES: UpgradeLevels = {
  capacity: 1,
  speed: 1,
  quality: 1,
  parking: 1,
  decor: 1,
  crew: 1,
};

export type UpgradeCategory = "Station" | "Clientèle" | "Équipe";

export const UPGRADES: Array<{
  key: UpgradeKey;
  icon: string;
  label: string;
  category: UpgradeCategory;
  desc: string;
  effect: (level: number) => string;
}> = [
  {
    key: "capacity",
    icon: "🚗",
    label: "File d'attente",
    category: "Station",
    desc: "Plus de voitures peuvent patienter avant le tunnel.",
    effect: (l) => `${2 + l} voitures en file`,
  },
  {
    key: "speed",
    icon: "⚡",
    label: "Rouleaux rapides",
    category: "Station",
    desc: "Tapis et rouleaux accélérés : les lavages s'enchaînent.",
    effect: (l) => `x${beltFactor(l).toFixed(2)} vitesse du tapis`,
  },
  {
    key: "quality",
    icon: "✨",
    label: "Qualité du lavage",
    category: "Station",
    desc: "Un lavage impeccable se paye plus cher.",
    effect: (l) => `${rewardRange(l)[0]}–${rewardRange(l)[1]} € par lavage`,
  },
  {
    key: "parking",
    icon: "🅿️",
    label: "Extension du parking",
    category: "Clientèle",
    desc: "Des places en plus : les clients arrivent plus souvent.",
    effect: (l) => `+${extraSlots(l)} places · clients x${attractFactor(l).toFixed(2)}`,
  },
  {
    key: "decor",
    icon: "🎨",
    label: "Décoration du car wash",
    category: "Clientèle",
    desc: "Enseigne, néons et plantes : les clients laissent un pourboire.",
    effect: (l) => `+${Math.round((tipFactor(l) - 1) * 100)} % de pourboire`,
  },
  {
    key: "crew",
    icon: "🧤",
    label: "Équipe de finition",
    category: "Équipe",
    desc: "Un polissage à la main peut transformer un lavage en prestation premium.",
    effect: (l) => `${Math.round(premiumChance(l) * 100)} % de lavages premium (x2)`,
  },
];

export function capacityOf(level: number) {
  return 2 + level; // 3 → 7
}

/** Places de parking supplémentaires apportées par l'extension. */
export function extraSlots(level: number) {
  return (level - 1) * 2; // 0 → 8
}

/** Nombre total de voitures pouvant patienter à la station. */
export function queueCapacity(up: UpgradeLevels) {
  return capacityOf(up.capacity) + extraSlots(up.parking);
}

export function beltFactor(level: number) {
  return 1 + (level - 1) * 0.25; // 1 → 2
}

/** Attractivité de la station : réduit l'attente entre deux clients. */
export function attractFactor(level: number) {
  return 1 + (level - 1) * 0.2; // 1 → 1.8
}

/** Intervalle (secondes) entre deux clients : min + aléa. */
export function washInterval(level: number, parking = 1): [number, number] {
  const f = beltFactor(level) * attractFactor(parking);
  return [9 / f, 12 / f];
}

export function rewardRange(level: number): [number, number] {
  const m = 1 + (level - 1) * 0.45;
  return [Math.round(6 * m), Math.round(12 * m)];
}

/** Multiplicateur de pourboire apporté par la décoration. */
export function tipFactor(level: number) {
  return 1 + (level - 1) * 0.12; // 1 → 1.48
}

/** Probabilité qu'un lavage soit "premium" (gain doublé). */
export function premiumChance(level: number) {
  return (level - 1) * 0.09; // 0 → 36 %
}

export function rollReward(level: number) {
  const [min, max] = rewardRange(level);
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Gain complet d'un lavage : base + pourboire, éventuellement premium. */
export function computeReward(up: UpgradeLevels): { amount: number; premium: boolean } {
  const base = rollReward(up.quality) * tipFactor(up.decor);
  const premium = Math.random() < premiumChance(up.crew);
  return { amount: Math.max(1, Math.round(base * (premium ? 2 : 1))), premium };
}

/** Coût du passage au niveau `level + 1`. */
export function upgradeCost(key: UpgradeKey, level: number) {
  const base =
    key === "quality"
      ? 140
      : key === "capacity"
        ? 100
        : key === "speed"
          ? 120
          : key === "parking"
            ? 90
            : key === "decor"
              ? 110
              : 160; // crew
  return Math.round(base * Math.pow(1.85, level - 1));
}

export function sanitizeUpgrades(raw: unknown): UpgradeLevels {
  const out = { ...DEFAULT_UPGRADES };
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(out) as UpgradeKey[]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        out[key] = Math.min(MAX_LEVEL, Math.max(1, Math.round(v)));
      }
    }
  }
  return out;
}
