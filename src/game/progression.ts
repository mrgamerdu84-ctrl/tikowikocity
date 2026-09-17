import type { UpgradeLevels } from "./upgrades";

export type CityProgress = {
  unlocked: string[];
};

export type ProgressionSnapshot = {
  money: number;
  washes: number;
  roads: number;
  houses: number;
  residents: number;
  decor: number;
  upgrades: UpgradeLevels;
};

export type ProgressionMilestone = {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: (s: ProgressionSnapshot) => { value: number; target: number };
};

export const CITY_MILESTONES: ProgressionMilestone[] = [
  { id: "first-street", title: "Première rue", description: "Trace 20 cases de route et accueille 4 habitants.", icon: "🛣️", progress: (s) => ({ value: Math.min(s.roads, 20) + Math.min(s.residents, 4) * 5, target: 40 }) },
  { id: "living-district", title: "Quartier vivant", description: "Construis 4 maisons, un espace public et réalise 12 lavages.", icon: "🏘️", progress: (s) => ({ value: Math.min(s.houses, 4) * 10 + Math.min(s.decor, 1) * 10 + Math.min(s.washes, 12) * 2.5, target: 80 }) },
  { id: "bright-city", title: "Ville éclairée", description: "Atteins 18 habitants et améliore trois fois le car wash.", icon: "💡", progress: (s) => ({ value: Math.min(s.residents, 18) * 3 + Math.min(Object.values(s.upgrades).reduce((n, l) => n + l - 1, 0), 3) * 12, target: 90 }) },
  { id: "prosperous-city", title: "Ville prospère", description: "Atteins 1 500 €, 8 maisons et 35 habitants.", icon: "🏙️", progress: (s) => ({ value: Math.min(s.money, 1500) / 25 + Math.min(s.houses, 8) * 5 + Math.min(s.residents, 35), target: 135 }) },
];

export const sanitizeCityProgress = (raw: unknown): CityProgress => {
  const value = raw as Partial<CityProgress> | null;
  return { unlocked: Array.isArray(value?.unlocked) ? value.unlocked.filter((id): id is string => typeof id === "string") : [] };
};

export function nextMilestone(progress: CityProgress, snapshot: ProgressionSnapshot) {
  const milestone = CITY_MILESTONES.find((item) => !progress.unlocked.includes(item.id));
  if (!milestone) return null;
  const state = milestone.progress(snapshot);
  return { ...milestone, value: Math.min(state.value, state.target), target: state.target, complete: state.value >= state.target };
}
