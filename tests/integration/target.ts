import { publicSupabaseConfig } from "../../src/lib/supabase-config.ts";
export type IntegrationEnvironment = Record<string, string | undefined>;
export function integrationTarget(env: IntegrationEnvironment) {
  if (
    env.DAWACARE_TEST_ENVIRONMENT !== "development" ||
    env.DAWACARE_TEST_ALLOW_WRITES !== "YES_SYNTHETIC_DEVELOPMENT"
  )
    throw new Error(
      "BLOCKED: explicitly select a synthetic development test environment before integration writes.",
    );
  const url = env.DAWACARE_TEST_SUPABASE_URL,
    key = env.DAWACARE_TEST_SUPABASE_PUBLISHABLE_KEY,
    serviceKey = env.DAWACARE_TEST_SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl = env.DAWACARE_TEST_DATABASE_URL;
  if (!url || !key || !serviceKey || !databaseUrl)
    throw new Error(
      "BLOCKED: development Supabase URL, public key, server key and database connection are required in secure local settings.",
    );
  const config = publicSupabaseConfig({ url, publishableKey: key });
  if (!config) throw new Error("BLOCKED: missing development configuration.");
  const host = new URL(config.url).hostname;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  const database = new URL(databaseUrl);
  const projectRef = env.DAWACARE_TEST_PROJECT_REF;
  if (local) {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname))
      throw new Error("BLOCKED: local API must use a local database.");
  } else {
    if (!projectRef || host !== `${projectRef}.supabase.co`)
      throw new Error(
        "BLOCKED: the development project ref must match its Supabase URL.",
      );
    if (database.searchParams.get("sslmode") !== "verify-full")
      throw new Error(
        "BLOCKED: remote database TLS must use sslmode=verify-full.",
      );
    if (
      !env.DAWACARE_TEST_EMAIL_DOMAIN ||
      env.DAWACARE_TEST_EMAIL_DOMAIN.endsWith(".invalid")
    )
      throw new Error(
        "BLOCKED: provide an owned development test mailbox domain.",
      );
  }
  const netlifyUrl = env.DAWACARE_TEST_NETLIFY_URL;
  if (netlifyUrl) {
    const preview = new URL(netlifyUrl);
    if (
      preview.hostname === "stunning-crumble-7aa0db.netlify.app" ||
      !["https:", "http:"].includes(preview.protocol) ||
      (!local && preview.protocol !== "https:")
    )
      throw new Error(
        "BLOCKED: use a separate HTTPS Netlify development site, never the deployed production origin.",
      );
  }
  return {
    ...config,
    serviceKey,
    databaseUrl,
    local,
    projectRef,
    emailDomain: env.DAWACARE_TEST_EMAIL_DOMAIN ?? "example.test",
    netlifyUrl: netlifyUrl ? new URL(netlifyUrl).origin : undefined,
  };
}
