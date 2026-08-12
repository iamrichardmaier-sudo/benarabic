import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Arabic Flashcards",
        short_name: "بطاقات",
        description: "Spaced-repetition flashcards for Fusha and Shaami Arabic.",
        lang: "en",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
      },
      workbox: {
        // Precache the app shell so a cold start with no network still boots.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        navigateFallback: "index.html",
        // The bundle ships a ~1MB chunk; the default 2MiB cap would drop it.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Card pictures: keep them viewable offline once seen.
            urlPattern: ({ url }) => url.hostname.endsWith("pexels.com"),
            handler: "CacheFirst",
            options: {
              cacheName: "card-images",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Bible chapter text never changes — cache each chapter the first
            // time it's read so flipping back to it (or reading offline) is instant.
            urlPattern: ({ url }) => url.pathname.includes("/bible/"),
            handler: "CacheFirst",
            options: {
              cacheName: "bible-text",
              expiration: { maxEntries: 1300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Supabase reads and writes must never be served from cache — stale
        // decks and silently-swallowed writes are worse than a clean failure
        // that the pending-changes queue already knows how to handle.
        navigateFallbackDenylist: [/^\/functions\//, /^\/rest\//, /^\/auth\//],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
