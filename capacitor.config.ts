import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.tikowikocarwash",
  appName: "TikowikoCarWash",
  // Fallback shell shown only if the remote app cannot be reached.
  webDir: "mobile/www",
  server: {
    // Cache-busting volontaire : l'APK recharge la publication la plus récente
    // au lieu de réutiliser une ancienne page conservée par Android WebView.
    url: "https://pixel-perfect-preview-16.lovable.app/?v=20260824-1152",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
