import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(here, "mobile-app"),
  base: "./",
  publicDir: path.resolve(here, "public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
    },
  },
  build: {
    outDir: path.resolve(here, "mobile/www"),
    emptyOutDir: true,
    sourcemap: false,
  },
});
