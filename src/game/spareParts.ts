export type StreetVendor = {
  id: string;
  name: string;
  x: number;
  z: number;
  partGrade: RollerPartGrade;
  color: number;
};

export const STREET_VENDORS: StreetVendor[] = [
  { id: "milo", name: "Milo Pièces", x: 10.4, z: -12, partGrade: "base", color: 0xe9a23b },
  { id: "nora", name: "Nora Mécanique", x: 1.6, z: 18, partGrade: "quality", color: 0x38a783 },
];

export type RollerPartGrade = "base" | "quality";
export const DEFAULT_ROLLER_PART_GRADE: RollerPartGrade = "base";
export const MIN_ROLLER_CONDITION = 35;

export const PART_GRADE_META: Record<RollerPartGrade, { label: string; wearPerWash: number }> = {
  base: { label: "Pièces de base", wearPerWash: 4 },
  quality: { label: "Pièces de qualité", wearPerWash: 2 },
};

export function sanitizeRollerPartGrade(raw: unknown): RollerPartGrade {
  return raw === "quality" ? "quality" : DEFAULT_ROLLER_PART_GRADE;
}

/** Le prix suit le niveau technique des rouleaux, avec un vrai écart premium. */
export function rollerPartPrice(grade: RollerPartGrade, rollerLevel: number) {
  const level = Math.min(5, Math.max(1, Math.round(rollerLevel)));
  const base = grade === "quality" ? 78 : 38;
  return Math.round(base * Math.pow(1.55, level - 1));
}

export function rollerWearPerWash(grade: RollerPartGrade) {
  return PART_GRADE_META[grade].wearPerWash;
}

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