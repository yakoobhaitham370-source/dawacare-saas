import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { integrationTarget } from "./tests/integration/target.ts";
export default defineConfig(() => {
  const env = {
    ...loadEnv("integration", process.cwd(), "DAWACARE_TEST_"),
    ...process.env,
  };
  if (env.DAWACARE_LOCAL_STATUS_FILE) {
    const status = JSON.parse(
      readFileSync(env.DAWACARE_LOCAL_STATUS_FILE, "utf8"),
    ) as Record<string, string>;
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(status.API_URL).hostname,
      )
    )
      throw new Error("BLOCKED: local status file contains a non-local API.");
    Object.assign(env, {
      DAWACARE_TEST_ENVIRONMENT: "development",
      DAWACARE_TEST_ALLOW_WRITES: "YES_SYNTHETIC_DEVELOPMENT",
      DAWACARE_TEST_SUPABASE_URL: status.API_URL,
      DAWACARE_TEST_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
      DAWACARE_TEST_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      DAWACARE_TEST_DATABASE_URL: status.DB_URL,
    });
  }
  integrationTarget(env);
  return {
    test: {
      environment: "node",
      include: ["tests/integration/**/*.test.ts"],
      env: Object.fromEntries(
        Object.entries(env).filter(
          ([key, value]) =>
            key.startsWith("DAWACARE_") && typeof value === "string",
        ),
      ) as Record<string, string>,
      fileParallelism: false,
      testTimeout: 30000,
      hookTimeout: 60000,
      reporters: ["default"],
    },
  };
});
