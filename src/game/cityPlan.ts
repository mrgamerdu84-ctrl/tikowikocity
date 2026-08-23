import { key, opposite, type Dir, DIR_VEC } from "./grid";
import { variantFor, type RoadHint } from "./catalog";

export type PlanCell = {
  hint: RoadHint;
  /** rotation choisie par le joueur, utilisée si la case n'a aucun voisin */
  rot: number;
  light: boolean;
  lamp: boolean;
  /** case posée par le jeu (route principale) : non modifiable */
  locked?: boolean;
};

export type SerializedPlan = Array<
  [number, number, RoadHint, number, boolean, boolean]
>;

export type SerializedHouses = Array<[number, number, number]>;

export type HouseCell = { level: number };

/** Plan de ville du joueur : uniquement des données, aucun objet Three.js. */
export class CityPlan {
  cells = new Map<string, PlanCell>();
  /** maisons du joueur (cases hors route, en bord de rue) */
  houses = new Map<string, HouseCell>();

  get(cx: number, cz: number) {
    return this.cells.get(key(cx, cz));
  }

  has(cx: number, cz: number) {
    return this.cells.has(key(cx, cz));
  }

  place(cx: number, cz: number, hint: RoadHint, rot: number, locked = false) {
    const prev = this.get(cx, cz);
    this.cells.set(key(cx, cz), {
      hint,
      rot,
      light: prev?.light ?? false,
      lamp: prev?.lamp ?? false,
      locked: prev?.locked ?? locked,
    });
  }

  remove(cx: number, cz: number) {
    const cell = this.get(cx, cz);
    if (cell?.locked) return false;
    return this.cells.delete(key(cx, cz));
  }

  setProp(cx: number, cz: number, prop: "light" | "lamp", value: boolean) {
    const cell = this.get(cx, cz);
    if (!cell) return false;
    cell[prop] = value;
    return true;
  }

  /** Masque des voisins routiers d'une case. */
  maskAt(cx: number, cz: number) {
    let mask = 0;
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIR_VEC[d]!;
      if (this.has(cx + dx, cz + dz)) mask |= 1 << d;
    }
    return mask;
  }

  /** Modèle + rotation à afficher pour une case. */
  variantAt(cx: number, cz: number) {
    const cell = this.get(cx, cz)!;
    const v = variantFor(this.maskAt(cx, cz), cell.hint);
    if (this.maskAt(cx, cz) === 0) {
      // pas de voisin : on respecte la rotation du joueur
      return { ...v, rot: cell.rot };
    }
    return v;
  }

  /** Directions réellement praticables depuis une case. */
  exitsAt(cx: number, cz: number): Dir[] {
    const out: Dir[] = [];
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIR_VEC[d]!;
      if (this.has(cx + dx, cz + dz)) out.push(d as Dir);
    }
    return out;
  }

  /** Sorties possibles en arrivant par `dirIn` (demi-tour en dernier recours). */
  exitsFrom(cx: number, cz: number, dirIn: Dir): Dir[] {
    const all = this.exitsAt(cx, cz);
    const usable = all.filter((d) => d !== opposite(dirIn));
    return usable.length ? usable : [opposite(dirIn)];
  }

  /* ---------- Maisons ---------- */
  house(cx: number, cz: number) {
    return this.houses.get(key(cx, cz));
  }

  /** Une maison ne se pose que sur une case libre bordant une route. */
  canPlaceHouse(cx: number, cz: number) {
    if (this.has(cx, cz) || this.houses.has(key(cx, cz))) return false;
    return this.maskAt(cx, cz) !== 0;
  }

  placeHouse(cx: number, cz: number, level = 1) {
    this.houses.set(key(cx, cz), { level });
  }

  removeHouse(cx: number, cz: number) {
    return this.houses.delete(key(cx, cz));
  }

  houseLevels() {
    return [...this.houses.values()].map((h) => h.level);
  }

  serializeHouses(): SerializedHouses {
    const out: SerializedHouses = [];
    this.houses.forEach((h, k) => {
      const [cx, cz] = k.split(",").map(Number);
      out.push([cx!, cz!, h.level]);
    });
    return out;
  }

  loadHouses(data: SerializedHouses) {
    this.houses.clear();
    data.forEach(([cx, cz, level]) => this.houses.set(key(cx, cz), { level }));
  }

  serialize(): SerializedPlan {
    const out: SerializedPlan = [];
    this.cells.forEach((c, k) => {
      if (c.locked) return;
      const [cx, cz] = k.split(",").map(Number);
      out.push([cx!, cz!, c.hint, c.rot, c.light, c.lamp]);
    });
    return out;
  }

  load(data: SerializedPlan) {
    // on conserve les cases verrouillées (route principale)
    [...this.cells.entries()].forEach(([k, c]) => {
      if (!c.locked) this.cells.delete(k);
    });
    data.forEach(([cx, cz, hint, rot, light, lamp]) => {
      this.cells.set(key(cx, cz), { hint, rot, light, lamp });
    });
  }
}
