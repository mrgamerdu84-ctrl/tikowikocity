/* Boutique d'améliorations du car wash.
   Chaque amélioration a 5 niveaux ; le niveau 1 est l'état de départ. */

export type UpgradeKey = "capacity" | "speed" | "quality";

export type UpgradeLevels = Record<UpgradeKey, number>;

export const MAX_LEVEL = 5;

export const DEFAULT_UPGRADES: UpgradeLevels = {
  capacity: 1,
  speed: 1,
  quality: 1,
};

export const UPGRADES: Array<{
  key: UpgradeKey;
  icon: string;
  label: string;
  desc: string;
  effect: (level: number) => string;
}> = [
  {
    key: "capacity",
    icon: "🅿️",
    label: "Capacité",
    desc: "Plus de voitures peuvent faire la queue au lavage.",
    effect: (l) => `${capacityOf(l)} voitures en file`,
  },
  {
    key: "speed",
    icon: "⚡",
    label: "Vitesse",
    desc: "Tapis plus rapide et clients plus fréquents.",
    effect: (l) => `x${beltFactor(l).toFixed(2)} vitesse du tapis`,
  },
  {
    key: "quality",
    icon: "✨",
    label: "Qualité",
    desc: "Un lavage impeccable se paye plus cher.",
    effect: (l) => `${rewardRange(l)[0]}–${rewardRange(l)[1]} € par lavage`,
  },
];

export function capacityOf(level: number) {
  return 2 + level; // 3 → 7
}

export function beltFactor(level: number) {
  return 1 + (level - 1) * 0.25; // 1 → 2
}

/** Intervalle (secondes) entre deux clients : min + aléa. */
export function washInterval(level: number): [number, number] {
  const f = beltFactor(level);
  return [9 / f, 12 / f];
}

export function rewardRange(level: number): [number, number] {
  const m = 1 + (level - 1) * 0.45;
  return [Math.round(6 * m), Math.round(12 * m)];
}

export function rollReward(level: number) {
  const [min, max] = rewardRange(level);
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Coût du passage au niveau `level + 1`. */
export function upgradeCost(key: UpgradeKey, level: number) {
  const base = key === "quality" ? 140 : key === "capacity" ? 100 : 120;
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
