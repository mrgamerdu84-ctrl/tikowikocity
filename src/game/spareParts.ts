export type StreetVendor = {
  id: string;
  name: string;
  x: number;
  z: number;
  price: number;
  color: number;
};

export const STREET_VENDORS: StreetVendor[] = [
  { id: "milo", name: "Milo Pièces", x: 10.4, z: -12, price: 45, color: 0xe9a23b },
  { id: "nora", name: "Nora Mécanique", x: 1.6, z: 18, price: 40, color: 0x38a783 },
];

export const ROLLER_WEAR_PER_WASH = 4;
export const MIN_ROLLER_CONDITION = 35;

export function sanitizeRollerCondition(raw: unknown) {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.round(Math.min(100, Math.max(MIN_ROLLER_CONDITION, raw)))
    : 100;
}

/** Des rouleaux très usés conservent 65 % de qualité, des rouleaux neufs 100 %. */
export function rollerQualityFactor(condition: number) {
  const safe = sanitizeRollerCondition(condition);
  return 0.65 + (safe / 100) * 0.35;
}

export function rollerQualityLoss(condition: number) {
  return Math.round((1 - rollerQualityFactor(condition)) * 100);
}