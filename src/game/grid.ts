/* Grille de construction : une case = une tuile de route Kenney (6 unités). */
export const TILE = 6;

/** 0 = Nord (-z), 1 = Est (+x), 2 = Sud (+z), 3 = Ouest (-x) */
export type Dir = 0 | 1 | 2 | 3;

export const DIR_VEC: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const opposite = (d: Dir): Dir => (((d + 2) % 4) as Dir);

export const key = (cx: number, cz: number) => `${cx},${cz}`;

export const parseKey = (k: string): [number, number] => {
  const [a, b] = k.split(",");
  return [Number(a), Number(b)];
};

export const cellToWorld = (c: number) => c * TILE;
export const worldToCell = (v: number) => Math.round(v / TILE);

/** Cap du modèle Kenney (nez vers +Z) pour une direction donnée. */
export const headingOf = (d: Dir) =>
  Math.atan2(DIR_VEC[d]![0], DIR_VEC[d]![1]);

/** Vecteur « à droite » du sens de circulation (conduite à droite). */
export const rightOf = (d: Dir): [number, number] => {
  const [dx, dz] = DIR_VEC[d]!;
  return [dz, -dx];
};

export const axisOf = (d: Dir): "x" | "z" => (d === 1 || d === 3 ? "x" : "z");
