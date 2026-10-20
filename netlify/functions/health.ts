import { createClient } from "@supabase/supabase-js";
import { serverConfiguration } from "../lib/config";
export default async (req: Request) => {
  const reply = (status: number, body: unknown) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (req.method !== "GET") return reply(405, { error: "Method not allowed" });
  const token = req.headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return reply(401, { error: "Authentication required" });
  let config;
  try {
    config = serverConfiguration();
  } catch {
    return reply(503, { error: "Development API configuration is incomplete" });
  }
  try {
    const server = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth = await server.auth.getUser(token);
    if (auth.error || !auth.data.user)
      return reply(401, { error: "Authentication required" });
    const scoped = createClient(config.url, config.key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const permission = await scoped.rpc("is_platform_admin");
    if (permission.error || !permission.data)
      return reply(403, { error: "Administrator MFA required" });
    const [settings, bucket, migrations] = await Promise.all([
      fetch(`${config.url}/auth/v1/settings`, {
        headers: { apikey: config.key },
        signal: AbortSignal.timeout(10000),
      }),
      server.storage.getBucket("patient-documents"),
      scoped
        .from("pharmacy_invitations")
        .select("id,delivery_lease_until")
        .limit(0),
    ]);
    const authSettings = settings.ok ? await settings.json() : null;
    const checks = {
      public_registration_disabled: authSettings?.disable_signup === true,
      private_documents: !bucket.error && bucket.data?.public === false,
      invitation_migration: !migrations.error,
      administrator_mfa: true,
    };
    const ready = Object.values(checks).every(Boolean);
    return reply(ready ? 200 : 503, {
      status: ready ? "ready" : "needs_configuration",
      checks,
      environment: config.development ? "development" : "configured",
    });
  } catch {
    return reply(503, {
      error:
        "Unable to verify backend health. No configuration values are exposed.",
    });
  }
};
