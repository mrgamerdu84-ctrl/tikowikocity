/* Maisons du joueur : posées en bord de route, elles attirent des habitants.
   3 niveaux : petite maison → maison familiale → petit immeuble. */

export const MAX_HOUSE_LEVEL = 3;

export type HouseDef = {
  level: number;
  label: string;
  icon: string;
  /** habitants maximum accueillis par la maison */
  capacity: number;
  /** coût de la pose (niveau 1) ou de l'amélioration vers ce niveau */
  cost: number;
  color: number;
  roof: number;
};

export const HOUSE_LEVELS: HouseDef[] = [
  { level: 1, label: "Petite maison", icon: "🏠", capacity: 2, cost: 60, color: 0xf6e3c5, roof: 0xc75b4a },
  { level: 2, label: "Maison familiale", icon: "🏡", capacity: 5, cost: 180, color: 0xd9ecf7, roof: 0x3f7fae },
  { level: 3, label: "Petit immeuble", icon: "🏢", capacity: 12, cost: 480, color: 0xe8e2f5, roof: 0x6a5b9a },
];

export const houseDef = (level: number) =>
  HOUSE_LEVELS[Math.min(MAX_HOUSE_LEVEL, Math.max(1, level)) - 1]!;

/** Capacité totale d'accueil de la ville. */
export const totalCapacity = (levels: number[]) =>
  levels.reduce((sum, l) => sum + houseDef(l).capacity, 0);
