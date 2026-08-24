import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.tikowikofamily.tikowikocity",
  appName: "TikowikoCity",
  // Le jeu web est maintenant embarqué dans l'APK : aucune publication Lovable
  // n'est nécessaire pour lancer la partie ou charger la ville.
  webDir: "mobile/www",
  android: {
    allowMixedContent: false,
  },
};

export default config;
