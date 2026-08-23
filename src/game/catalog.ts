import type { Dir } from "./grid";

/* Catalogue des pièces constructibles.
   Chaque modèle Kenney a un masque de connexions de référence (rotation 0) :
   bit 0 = Nord, 1 = Est, 2 = Sud, 3 = Ouest. */
export type RoadHint = "straight" | "bend" | "intersection" | "crossroad";

export type BuildTool = RoadHint | "light" | "lamp" | "erase";

export const BASE_MASK: Record<string, number> = {
  "road-end": 0b0001, // Nord seul
  "road-straight": 0b0101, // Nord + Sud
  "road-bend": 0b0011, // Nord + Est
  "road-intersection": 0b0111, // Nord + Est + Sud
  "road-crossroad": 0b1111,
};

export const HINT_MODEL: Record<RoadHint, string> = {
  straight: "road-straight",
  bend: "road-bend",
  intersection: "road-intersection",
  crossroad: "road-crossroad",
};

export const TOOL_LABEL: Record<BuildTool, string> = {
  straight: "🛣️ Droite",
  bend: "↩️ Virage",
  intersection: "⊣ Carrefour T",
  crossroad: "✚ Carrefour",
  light: "🚦 Feu",
  lamp: "💡 Lampadaire",
  erase: "🧹 Gomme",
};

/** rotation.y = r * 90° envoie la direction d sur (d - r) mod 4. */
const rotateMask = (mask: number, r: number) => {
  let out = 0;
  for (let d = 0; d < 4; d++) {
    if (mask & (1 << d)) out |= 1 << ((d - r + 4) % 4);
  }
  return out;
};

export const maskDirs = (mask: number): Dir[] => {
  const out: Dir[] = [];
  for (let d = 0; d < 4; d++) if (mask & (1 << d)) out.push(d as Dir);
  return out;
};

/** Choisit le modèle + la rotation qui raccordent exactement les voisins. */
export const variantFor = (
  mask: number,
  hint: RoadHint,
): { model: string; rot: number; mask: number } => {
  const count = maskDirs(mask).length;
  let model: string;
  if (count === 0) model = HINT_MODEL[hint];
  else if (count === 1) model = "road-end";
  else if (count === 2) {
    const [a, b] = maskDirs(mask);
    model = (a! + 2) % 4 === b! ? "road-straight" : "road-bend";
  } else if (count === 3) model = "road-intersection";
  else model = "road-crossroad";

  const base = BASE_MASK[model]!;
  for (let r = 0; r < 4; r++) {
    if (rotateMask(base, r) === mask) return { model, rot: r, mask };
  }
  // aucune case voisine : on garde l'orientation demandée par le joueur
  return { model, rot: 0, mask: base };
};
