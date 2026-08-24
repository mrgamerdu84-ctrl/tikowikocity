import { createServerFn } from "@tanstack/react-start";

type SaveInput = { fileName: string; payload: unknown };

/**
 * La sauvegarde Google Drive est désactivée dans la version publique.
 * Le jeu conserve sa sauvegarde locale automatique.
 */
export const saveToDrive = createServerFn({ method: "POST" })
  .inputValidator((input: SaveInput) => {
    if (!input || typeof input.fileName !== "string" || input.fileName.length > 120) {
      throw new Error("Nom de fichier invalide.");
    }
    return {
      fileName: input.fileName.replace(/[/\\]/g, "-"),
      payload: input.payload,
    };
  })
  .handler(async () => {
    throw new Error(
      "Sauvegarde Google Drive désactivée pour la version publique. La sauvegarde locale automatique reste active.",
    );
  });

export type SaveEnvelope = {
  version: number;
  app: "TikowikoCity";
  savedAt: string;
  state: Record<string, unknown>;
};

export const loadFromDrive = createServerFn({ method: "POST" }).handler(async () => ({
  found: false as const,
}));
