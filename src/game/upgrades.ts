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

export type UpgradePreview = {
  current: string;
  next: string;
  change: string;
  impact: string;
};

/** Comparaison contextuelle exacte affichée avant l'achat d'une amélioration. */
export function upgradePreview(
  key: UpgradeKey,
  level: number,
  upgrades: UpgradeLevels,
): UpgradePreview {
  const nextLevel = Math.min(MAX_LEVEL, level + 1);

  if (key === "capacity") {
    const current = queueCapacity(upgrades);
    const next = queueCapacity({ ...upgrades, capacity: nextLevel });
    return {
      current: `${current} voitures peuvent patienter`,
      next: `${next} voitures peuvent patienter`,
      change: `+${next - current} voiture dans la file`,
      impact: "La station refuse moins de clients lorsque le tunnel est occupé.",
    };
  }

  if (key === "speed") {
    const currentFactor = beltFactor(level);
    const nextFactor = beltFactor(nextLevel);
    const currentInterval = washInterval(level, upgrades.parking);
    const nextInterval = washInterval(nextLevel, upgrades.parking);
    return {
      current: `Tapis x${currentFactor.toFixed(2)} · clients toutes les ${currentInterval[0].toFixed(1)}–${currentInterval[1].toFixed(1)} s`,
      next: `Tapis x${nextFactor.toFixed(2)} · clients toutes les ${nextInterval[0].toFixed(1)}–${nextInterval[1].toFixed(1)} s`,
      change: `+${Math.round((nextFactor / currentFactor - 1) * 100)} % de vitesse`,
      impact: "Le tapis et les rouleaux accélèrent, donc davantage de voitures sont lavées.",
    };
  }

  if (key === "quality") {
    const current = rewardRange(level);
    const next = rewardRange(nextLevel);
    const currentAverage = Math.round((current[0] + current[1]) / 2);
    const nextAverage = Math.round((next[0] + next[1]) / 2);
    return {
      current: `${current[0]}–${current[1]} € par lavage`,
      next: `${next[0]}–${next[1]} € par lavage`,
      change: `Environ +${nextAverage - currentAverage} € par lavage`,
      impact: "Chaque voiture lavée rapporte une base plus élevée avant pourboire et bonus premium.",
    };
  }

  if (key === "parking") {
    const currentSlots = extraSlots(level);
    const nextSlots = extraSlots(nextLevel);
    const currentInterval = washInterval(upgrades.speed, level);
    const nextInterval = washInterval(upgrades.speed, nextLevel);
    return {
      current: `+${currentSlots} places · clients toutes les ${currentInterval[0].toFixed(1)}–${currentInterval[1].toFixed(1)} s`,
      next: `+${nextSlots} places · clients toutes les ${nextInterval[0].toFixed(1)}–${nextInterval[1].toFixed(1)} s`,
      change: `+${nextSlots - currentSlots} places · arrivées ${Math.round((attractFactor(nextLevel) / attractFactor(level) - 1) * 100)} % plus rapides`,
      impact: "Le parking agrandit la file totale et attire plus souvent de nouveaux clients.",
    };
  }

  if (key === "decor") {
    const current = Math.round((tipFactor(level) - 1) * 100);
    const next = Math.round((tipFactor(nextLevel) - 1) * 100);
    return {
      current: `+${current} % sur chaque gain`,
      next: `+${next} % sur chaque gain`,
      change: `+${next - current} points de pourboire`,
      impact: "L'enseigne et les décorations augmentent directement le montant final de chaque lavage.",
    };
  }

  const current = Math.round(premiumChance(level) * 100);
  const next = Math.round(premiumChance(nextLevel) * 100);
  return {
    current: `${current} % de chance de gain doublé`,
    next: `${next} % de chance de gain doublé`,
    change: `+${next - current} points de chance premium`,
    impact: "L'équipe de finition peut doubler le gain complet d'un lavage, pourboire compris.",
  };
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
