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

export function effectiveArrivalInterval(upgrades: UpgradeLevels, residents: number, behavior: ClientBehavior): [number, number] {
  const [lo, hi] = washInterval(upgrades.speed, upgrades.parking);
  const crowd = 1 / (1 + Math.max(0, residents) / 25);
  const frequency = behavior.frequency / 100;
  return [lo * crowd / frequency, (hi + 3) * crowd / frequency];
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