import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/turbo-loop-legends/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "Turbo Loop Legends",
        short_name: "Turbo Loops",
        description: "Carreras, saltos y loopings imposibles.",
        theme_color: "#10233f",
        background_color: "#10233f",
        display: "standalone",
        orientation: "landscape",
        start_url: "/turbo-loop-legends/",
        icons: [
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "index.html"
      }
    })
  ],
  build: {
    target: "es2022",
    sourcemap: true
  }
});
