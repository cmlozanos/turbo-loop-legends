import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const buildVersion = (process.env.VITE_BUILD_VERSION ?? process.env.GITHUB_SHA ?? "local")
  .replace(/[^a-zA-Z0-9_-]/g, "-")
  .slice(0, 12);

export default defineConfig({
  base: "/turbo-loop-legends/",
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifestFilename: `manifest-${buildVersion}.webmanifest`,
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
            src: `icons/icon.svg?v=${buildVersion}`,
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        ignoreURLParametersMatching: [/^v$/],
      }
    })
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${buildVersion}-[hash].js`,
        chunkFileNames: `assets/[name]-${buildVersion}-[hash].js`,
        assetFileNames: `assets/[name]-${buildVersion}-[hash][extname]`,
      },
    },
  }
});
