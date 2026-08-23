export type TenantNeedKind = "light" | "park" | "parking" | "comfort";

export type TenantNeed = {
  id: string;
  kind: TenantNeedKind;
  icon: string;
  label: string;
  cost: number;
};

export type Rental = {
  houseKey: string;
  level: number;
  tenant: string;
  rent: number;
  tax: number;
  happiness: number;
  acceptedAt: number;
  lastPaidAt: number;
  need?: TenantNeed;
};

export type RentalOffer = {
  houseKey: string;
  level: number;
  tenant: string;
  rent: number;
  tax: number;
};

export const RENT_CYCLE_MS = 60_000;

const TENANTS = [
  "Camille",
  "Alex",
  "Lou",
  "Noa",
  "Charlie",
  "Sacha",
  "Morgan",
  "Robin",
  "Eden",
  "Sam",
];

const NEEDS: Array<Omit<TenantNeed, "id">> = [
  { kind: "light", icon: "💡", label: "Plus de lumière dans la rue", cost: 12 },
  { kind: "park", icon: "🌳", label: "Un espace vert à proximité", cost: 18 },
  { kind: "parking", icon: "🅿️", label: "Une place de stationnement", cost: 15 },
  { kind: "comfort", icon: "🛋️", label: "Améliorer le confort du logement", cost: 22 },
];

export function rentForLevel(level: number) {
  return [0, 42, 96, 225][Math.min(3, Math.max(1, level))] ?? 42;
}

export function taxForLevel(level: number) {
  return [0, 8, 19, 45][Math.min(3, Math.max(1, level))] ?? 8;
}

export function tenantForHouse(houseKey: string, index = 0) {
  let hash = index;
  for (let i = 0; i < houseKey.length; i++) hash = (hash * 31 + houseKey.charCodeAt(i)) >>> 0;
  return TENANTS[hash % TENANTS.length]!;
}

export function makeRentalOffer(houseKey: string, level: number, index = 0): RentalOffer {
  return {
    houseKey,
    level,
    tenant: tenantForHouse(houseKey, index),
    rent: rentForLevel(level),
    tax: taxForLevel(level),
  };
}

export function makeNeed(seed = Date.now()): TenantNeed {
  const base = NEEDS[Math.abs(seed) % NEEDS.length]!;
  return { ...base, id: `${seed}-${Math.random().toString(36).slice(2, 7)}` };
}
