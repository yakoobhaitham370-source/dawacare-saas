import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import {
  publicSupabaseConfig,
  assertNoPrivateFrontendKeys,
  verifyDevelopmentFrontendTarget,
} from "./src/lib/supabase-config.ts";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  assertNoPrivateFrontendKeys(env);
  verifyDevelopmentFrontendTarget(env);
  publicSupabaseConfig({
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  return {
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
  };
});
