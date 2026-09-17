/* Niveaux de quartier : chaque palier se paie, débloque de nouvelles
   constructions et augmente durablement la fréquentation du car wash. */

import type { BuildTool } from "./catalog";
import type { DecorKind } from "./decor";

export type DistrictLevel = {
  level: number;
  title: string;
  icon: string;
  /** coût à payer pour ouvrir le niveau */
  cost: number;
  /** conditions minimales avant de pouvoir payer */
  requires: { roads: number; houses: number; residents: number; washes: number };
  /** bonus de fréquentation propre au niveau, en pourcentage */
  demandBonus: number;
  tools: BuildTool[];
  decor: DecorKind[];
  houseLevel: number;
  summary: string;
};

export const DISTRICT_LEVELS: DistrictLevel[] = [
  {
    level: 1,
    title: "Hameau du car wash",
    icon: "🛣️",
    cost: 0,
    requires: { roads: 0, houses: 0, residents: 0, washes: 0 },
    demandBonus: 0,
    tools: ["straight", "bend", "house", "park", "erase", "bulldoze"],
    decor: ["park", "garden"],
    houseLevel: 1,
    summary: "Routes de base, premières maisons et petits espaces verts.",
  },
  {
    level: 2,
    title: "Quartier résidentiel",
    icon: "🏘️",
    cost: 250,
    requires: { roads: 14, houses: 2, residents: 3, washes: 6 },
    demandBonus: 10,
    tools: ["intersection", "parking", "lamp"],
    decor: ["parking", "playground"],
    houseLevel: 2,
    summary: "Carrefours en T, parkings, aires de jeux et maisons niveau 2.",
  },
  {
    level: 3,
    title: "Centre animé",
    icon: "🏙️",
    cost: 900,
    requires: { roads: 26, houses: 5, residents: 12, washes: 25 },
    demandBonus: 22,
    tools: ["crossroad", "light"],
    decor: ["fountain", "carport"],
    houseLevel: 3,
    summary: "Grands carrefours, feux, fontaines, parkings couverts et immeubles.",
  },
  {
    level: 4,
    title: "Pôle d’attraction",
    icon: "🌟",
    cost: 2600,
    requires: { roads: 40, houses: 9, residents: 28, washes: 60 },
    demandBonus: 38,
    tools: ["wash"],
    decor: ["truckstop"],
    houseLevel: 3,
    summary: "Aire poids lourds, personnalisation complète du car wash.",
  },
];

export const MAX_DISTRICT_LEVEL = DISTRICT_LEVELS.length;

export type DistrictSnapshot = {
  roads: number;
  houses: number;
  residents: number;
  washes: number;
};

export const districtAt = (level: number) =>
  DISTRICT_LEVELS[Math.min(Math.max(level, 1), MAX_DISTRICT_LEVEL) - 1]!;

export const sanitizeDistrictLevel = (raw: unknown) =>
  typeof raw === "number" && Number.isFinite(raw)
    ? Math.min(MAX_DISTRICT_LEVEL, Math.max(1, Math.round(raw)))
    : 1;

/** Bonus cumulé de fréquentation apporté par les niveaux déjà ouverts. */
export function districtDemandBonus(level: number) {
  const current = sanitizeDistrictLevel(level);
  return DISTRICT_LEVELS.filter((entry) => entry.level <= current).reduce(
    (sum, entry) => sum + entry.demandBonus,
    0,
  );
}

export const districtDemandFactor = (level: number) => 1 + districtDemandBonus(level) / 100;

/** Outils et décors disponibles au niveau atteint. */
export function districtUnlocks(level: number) {
  const current = sanitizeDistrictLevel(level);
  const open = DISTRICT_LEVELS.filter((entry) => entry.level <= current);
  return {
    tools: new Set<BuildTool>(open.flatMap((entry) => entry.tools)),
    decor: new Set<DecorKind>(open.flatMap((entry) => entry.decor)),
    houseLevel: open.reduce((max, entry) => Math.max(max, entry.houseLevel), 1),
  };
}

export type DistrictProgress = {
  next: DistrictLevel;
  ready: boolean;
  affordable: boolean;
  missing: Array<{ label: string; value: number; target: number }>;
};

/** Prochain palier et ce qu’il reste à accomplir pour l’ouvrir. */
export function nextDistrictLevel(
  level: number,
  snapshot: DistrictSnapshot,
  money: number,
): DistrictProgress | null {
  const current = sanitizeDistrictLevel(level);
  const next = DISTRICT_LEVELS.find((entry) => entry.level === current + 1);
  if (!next) return null;
  const checks: Array<[string, number, number]> = [
    ["Routes", snapshot.roads, next.requires.roads],
    ["Maisons", snapshot.houses, next.requires.houses],
    ["Habitants", snapshot.residents, next.requires.residents],
    ["Lavages", snapshot.washes, next.requires.washes],
  ];
  const missing = checks
    .filter(([, value, target]) => value < target)
    .map(([label, value, target]) => ({ label, value, target }));
  return {
    next,
    ready: missing.length === 0,
    affordable: money >= next.cost,
    missing,
  };
}
