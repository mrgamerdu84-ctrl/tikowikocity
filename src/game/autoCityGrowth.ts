export type AutoCityStageKind = "road" | "house" | "park" | "parking";

export type AutoCityStage = {
  unlockMoney: number;
  kind: AutoCityStageKind;
  dx: number;
  cz: number;
  level?: number;
  rot?: number;
  label: string;
};

/**
 * Plan d'urbanisation automatique, relatif à la grande avenue principale.
 * Les paliers utilisent l'argent disponible comme indicateur de prospérité :
 * la ville se développe sans retirer cet argent au joueur.
 */
export const AUTO_CITY_STAGES: AutoCityStage[] = [
  { unlockMoney: 220, kind: "road", dx: -1, cz: 0, label: "Rue des Sources" },
  { unlockMoney: 320, kind: "road", dx: -2, cz: 0, label: "Rue des Sources" },
  { unlockMoney: 480, kind: "house", dx: -1, cz: -1, level: 1, label: "Maison des Sources" },
  { unlockMoney: 650, kind: "house", dx: -2, cz: -1, level: 1, label: "Maison des Sources" },
  { unlockMoney: 850, kind: "park", dx: -2, cz: 1, label: "Petit parc des Sources" },

  { unlockMoney: 1050, kind: "road", dx: 1, cz: 3, label: "Avenue du Soleil" },
  { unlockMoney: 1250, kind: "road", dx: 2, cz: 3, label: "Avenue du Soleil" },
  { unlockMoney: 1500, kind: "house", dx: 1, cz: 2, level: 2, label: "Résidence Soleil" },
  { unlockMoney: 1800, kind: "house", dx: 2, cz: 2, level: 2, label: "Résidence Soleil" },
  { unlockMoney: 2150, kind: "parking", dx: 2, cz: 4, label: "Parking du Soleil" },

  { unlockMoney: 2500, kind: "road", dx: -1, cz: 6, label: "Boulevard des Collines" },
  { unlockMoney: 2900, kind: "road", dx: -2, cz: 6, label: "Boulevard des Collines" },
  { unlockMoney: 3400, kind: "house", dx: -1, cz: 5, level: 2, label: "Maisons des Collines" },
  { unlockMoney: 4000, kind: "house", dx: -2, cz: 5, level: 3, label: "Immeuble des Collines" },
  { unlockMoney: 4700, kind: "park", dx: -2, cz: 7, label: "Parc des Collines" },

  { unlockMoney: 5500, kind: "road", dx: 1, cz: 9, label: "Quartier du Lac" },
  { unlockMoney: 6400, kind: "road", dx: 2, cz: 9, label: "Quartier du Lac" },
  { unlockMoney: 7400, kind: "house", dx: 1, cz: 8, level: 3, label: "Résidence du Lac" },
  { unlockMoney: 8500, kind: "house", dx: 2, cz: 8, level: 3, label: "Résidence du Lac" },
  { unlockMoney: 9800, kind: "park", dx: 2, cz: 10, label: "Grand parc du Lac" },
];
