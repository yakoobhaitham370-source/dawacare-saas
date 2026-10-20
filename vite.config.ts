import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "DawaCare",
        short_name: "DawaCare",
        description: "Pharmacy care workspace",
        theme_color: "#087f72",
        background_color: "#f5f8f7",
        display: "standalone",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg}"],
        navigateFallbackDenylist: [/^\/api/, /^\/\.netlify/],
        runtimeCaching: [],
      },
    }),
  ],
});
