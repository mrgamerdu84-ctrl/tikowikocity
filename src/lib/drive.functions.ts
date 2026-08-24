type SaveInput = { fileName: string; payload: unknown };

type SaveCall = (args: { data: SaveInput }) => Promise<never>;
type LoadCall = (args?: { data?: undefined }) => Promise<{ found: false }>;

/**
 * Google Drive est désactivé dans la version publique.
 * Ces fonctions sont de simples stubs côté application : aucun endpoint serveur,
 * aucune clé et aucune passerelle externe ne sont exposés.
 * La sauvegarde locale automatique du jeu reste active.
 */
export const saveToDrive = (async (_args: { data: SaveInput }) => {
  throw new Error(
    "Sauvegarde Google Drive désactivée pour la version publique. La sauvegarde locale automatique reste active.",
  );
}) as SaveCall;

export type SaveEnvelope = {
  version: number;
  app: "TikowikoCity";
  savedAt: string;
  state: Record<string, unknown>;
};

export const loadFromDrive = (async (_args?: { data?: undefined }) => ({
  found: false as const,
})) as LoadCall;
