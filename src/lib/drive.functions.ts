type SaveInput = { fileName: string; payload: unknown };

type SaveResult = {
  name: string;
  webViewLink?: string;
};

type LoadResult =
  | { found: false }
  | {
      found: true;
      stateJson: string;
      fileName?: string;
    };

type SaveCall = (args: { data: SaveInput }) => Promise<SaveResult>;
type LoadCall = (args?: { data?: undefined }) => Promise<LoadResult>;

/**
 * Google Drive est désactivé dans la version publique.
 * Ces fonctions sont de simples stubs côté application : aucun endpoint serveur,
 * aucune clé et aucune passerelle externe ne sont exposés.
 * La sauvegarde locale automatique du jeu reste active.
 *
 * Les types gardent la forme historique des réponses Drive afin que l'interface
 * existante reste compilable, même si ces branches ne sont jamais utilisées
 * dans l'APK autonome.
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
