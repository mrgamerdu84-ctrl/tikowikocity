/* Éléments décoratifs posables librement sur les cases libres :
   espaces verts (parcs) et zones de stationnement (parkings). */

export type DecorKind =
  | "park"
  | "garden"
  | "fountain"
  | "playground"
  | "parking"
  | "carport"
  | "truckstop";

export type DecorCategory = "park" | "parking";

export type DecorDef = {
  kind: DecorKind;
  category: DecorCategory;
  label: string;
  icon: string;
  cost: number;
};

export const DECOR: DecorDef[] = [
  { kind: "park", category: "park", label: "Parc arboré", icon: "🌳", cost: 40 },
  { kind: "garden", category: "park", label: "Jardin fleuri", icon: "🌷", cost: 30 },
  { kind: "fountain", category: "park", label: "Fontaine", icon: "⛲", cost: 120 },
  { kind: "playground", category: "park", label: "Aire de jeux", icon: "🛝", cost: 90 },
  { kind: "parking", category: "parking", label: "Parking", icon: "🅿️", cost: 70 },
  { kind: "carport", category: "parking", label: "Parking couvert", icon: "🏗️", cost: 150 },
  { kind: "truckstop", category: "parking", label: "Aire poids lourds", icon: "🚚", cost: 200 },
];

export const decorDef = (kind: DecorKind) =>
  DECOR.find((d) => d.kind === kind) ?? DECOR[0]!;

export const decorOf = (category: DecorCategory) =>
  DECOR.filter((d) => d.category === category);

export const isDecorKind = (v: unknown): v is DecorKind =>
  typeof v === "string" && DECOR.some((d) => d.kind === v);

/* ---------- Personnalisation du car wash ---------- */

export type WashStyle = {
  /** index dans WASH_COLORS */
  color: number;
  sign: boolean;
  flags: boolean;
  plants: boolean;
  neon: boolean;
};

export const WASH_COLORS = [
  { label: "Azur", hex: 0x3aa7e0 },
  { label: "Menthe", hex: 0x3fc79a },
  { label: "Soleil", hex: 0xf5b93b },
  { label: "Corail", hex: 0xef6f5c },
  { label: "Violet", hex: 0x8b6ad1 },
  { label: "Graphite", hex: 0x5a6470 },
];

export const DEFAULT_WASH_STYLE: WashStyle = {
  color: 0,
  sign: true,
  flags: false,
  plants: true,
  neon: false,
};

export const sanitizeWashStyle = (v: unknown): WashStyle => {
  const s = (v ?? {}) as Partial<WashStyle>;
  return {
    color:
      typeof s.color === "number" && s.color >= 0 && s.color < WASH_COLORS.length
        ? Math.floor(s.color)
        : DEFAULT_WASH_STYLE.color,
    sign: typeof s.sign === "boolean" ? s.sign : DEFAULT_WASH_STYLE.sign,
    flags: typeof s.flags === "boolean" ? s.flags : DEFAULT_WASH_STYLE.flags,
    plants: typeof s.plants === "boolean" ? s.plants : DEFAULT_WASH_STYLE.plants,
    neon: typeof s.neon === "boolean" ? s.neon : DEFAULT_WASH_STYLE.neon,
  };
};
