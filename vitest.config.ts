import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "supabase/tests/**/*.test.ts"],
    testTimeout: 20000,
  },
});
