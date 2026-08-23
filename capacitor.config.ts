import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.tikowikocarwash",
  appName: "TikowikoCarWash",
  // Fallback shell shown only if the remote app cannot be reached.
  webDir: "mobile/www",
  server: {
    // The APK loads the published web app, so every publish updates the app.
    url: "https://pixel-perfect-preview-16.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
