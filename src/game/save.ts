/**
 * Sauvegarde locale automatique de la ville (routes, maisons, décor, économie…).
 * Le joueur retrouve sa création telle quelle en revenant plus tard, même sans
 * Google Drive.
 */
const KEY = "tikowiko.city.v1";

export type LocalSave = {
  version: number;
  savedAt: string;
  state: Record<string, unknown>;
};

export function saveLocalCity(state: Record<string, unknown>, version = 1) {
  if (typeof window === "undefined") return;
  try {
    const payload: LocalSave = {
      version,
      savedAt: new Date().toISOString(),
      state,
    };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // quota plein ou stockage indisponible : on ignore, le jeu continue
  }
}

export function readLocalCity(): LocalSave | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalSave;
    if (!parsed || typeof parsed !== "object" || typeof parsed.state !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalCity() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignoré
  }
}
