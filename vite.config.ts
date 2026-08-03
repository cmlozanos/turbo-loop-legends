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
    {
      name: "version-pwa-head-assets",
      transformIndexHtml: {
        order: "pre",
        handler: (html) => html.replaceAll("__BUILD_VERSION__", buildVersion),
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      manifestFilename: `manifest-${buildVersion}.webmanifest`,
      includeAssets: [
        "icons/icon.svg",
        "icons/icon-maskable.svg",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        id: "/turbo-loop-legends/",
        name: "Turbo Loop Legends",
        short_name: "Turbo Loops",
        description: "Carreras, saltos y loopings imposibles.",
        lang: "es",
        dir: "ltr",
        scope: "/turbo-loop-legends/",
        theme_color: "#10233f",
        background_color: "#10233f",
        display: "standalone",
        display_override: ["fullscreen", "standalone"],
        orientation: "landscape",
        start_url: "/turbo-loop-legends/",
        categories: ["games", "kids"],
        icons: [
          {
            src: `icons/icon-192.png?v=${buildVersion}`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `icons/icon-512.png?v=${buildVersion}`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `icons/icon-maskable-512.png?v=${buildVersion}`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
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
