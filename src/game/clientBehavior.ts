import { beltFactor, rewardRange, tipFactor, washInterval, type UpgradeLevels } from "./upgrades";

export type ClientBehavior = {
  frequency: number;
  payment: number;
  washTime: number;
};

export const DEFAULT_CLIENT_BEHAVIOR: ClientBehavior = {
  frequency: 100,
  payment: 100,
  washTime: 100,
};

export type NeighborhoodStats = {
  houses: number;
  residents: number;
  roads: number;
  parking: number;
};

export type NeighborhoodDemand = {
  factor: number;
  bonusPercent: number;
  housesPercent: number;
  residentsPercent: number;
  roadsPercent: number;
  parkingPercent: number;
};

export type TravelerDemand = {
  travelersPerHour: number;
  cleanCarSeekers: number;
  bonusPercent: number;
  factor: number;
};

/** Flux simulé : la voirie crée le passage et les parkings convertissent des voyageurs. */
export function travelerDemand(stats: NeighborhoodStats): TravelerDemand {
  const travelersPerHour = Math.min(180, Math.max(0, stats.roads) * 3 + Math.max(0, stats.parking) * 12);
  const seekerRate = Math.min(0.28, 0.08 + Math.max(0, stats.parking) * 0.025);
  const cleanCarSeekers = Math.round(travelersPerHour * seekerRate);
  const bonusPercent = Math.min(35, Math.round(cleanCarSeekers * 1.5));
  return { travelersPerHour: Math.round(travelersPerHour), cleanCarSeekers, bonusPercent, factor: 1 + bonusPercent / 100 };
}

/** Bonus d'affluence apporté par le quartier, plafonné pour préserver le trafic. */
export function neighborhoodDemand(stats: NeighborhoodStats): NeighborhoodDemand {
  const housesPercent = Math.min(30, Math.max(0, stats.houses) * 4);
  const residentsPercent = Math.min(55, Math.max(0, stats.residents) * 2.2);
  const roadsPercent = Math.min(25, Math.max(0, stats.roads - 8) * 1.25);
  const parkingPercent = Math.min(35, Math.max(0, stats.parking) * 9);
  const bonusPercent = Math.min(120, housesPercent + residentsPercent + roadsPercent + parkingPercent);
  return {
    factor: 1 + bonusPercent / 100,
    bonusPercent: Math.round(bonusPercent),
    housesPercent: Math.round(housesPercent),
    residentsPercent: Math.round(residentsPercent),
    roadsPercent: Math.round(roadsPercent),
    parkingPercent: Math.round(parkingPercent),
  };
}

const clampPercent = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.min(max, Math.max(min, value)))
    : fallback;

export function sanitizeClientBehavior(raw: unknown): ClientBehavior {
  const value = raw && typeof raw === "object" ? raw as Partial<ClientBehavior> : {};
  return {
    frequency: clampPercent(value.frequency, 50, 150, DEFAULT_CLIENT_BEHAVIOR.frequency),
    payment: clampPercent(value.payment, 75, 150, DEFAULT_CLIENT_BEHAVIOR.payment),
    washTime: clampPercent(value.washTime, 70, 140, DEFAULT_CLIENT_BEHAVIOR.washTime),
  };
}

export function effectiveArrivalInterval(upgrades: UpgradeLevels, neighborhood: NeighborhoodStats, behavior: ClientBehavior): [number, number] {
  const [lo, hi] = washInterval(upgrades.speed, upgrades.parking);
  const district = neighborhoodDemand(neighborhood).factor;
  const travelers = travelerDemand(neighborhood).factor;
  const frequency = behavior.frequency / 100;
  return [lo / district / travelers / frequency, (hi + 3) / district / travelers / frequency];
}

export function effectiveBeltFactor(upgrades: UpgradeLevels, behavior: ClientBehavior) {
  return beltFactor(upgrades.speed) * (100 / behavior.washTime);
}

export function effectiveWashDuration(upgrades: UpgradeLevels, behavior: ClientBehavior) {
  const tunnelLength = 7;
  const beltSpeed = 1.1 * effectiveBeltFactor(upgrades, behavior);
  return tunnelLength / beltSpeed;
}

export function paymentPreview(upgrades: UpgradeLevels, behavior: ClientBehavior, rollerQuality: number) {
  const [min, max] = rewardRange(upgrades.quality);
  const factor = tipFactor(upgrades.decor) * (behavior.payment / 100) * rollerQuality;
  return [Math.max(1, Math.round(min * factor)), Math.max(1, Math.round(max * factor))] as const;
}