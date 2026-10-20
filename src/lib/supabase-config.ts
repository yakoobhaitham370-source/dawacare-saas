export type PublicSupabaseEnvironment = {
  url?: string;
  anonKey?: string;
  publishableKey?: string;
};
export function publicSupabaseConfig(
  env: PublicSupabaseEnvironment,
): { url: string; key: string } | null {
  const url = env.url?.trim(),
    legacy = env.anonKey?.trim(),
    modern = env.publishableKey?.trim();
  if (!url && !legacy && !modern) return null;
  if (!url || (!legacy && !modern))
    throw new Error(
      "Set the Supabase project URL and public client key together.",
    );
  if (legacy && modern && legacy !== modern)
    throw new Error("Configure one public Supabase key, not conflicting keys.");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Use a valid Supabase project URL.");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !["", "/"].includes(parsed.pathname) ||
    !(
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
    )
  )
    throw new Error(
      "Use an HTTPS Supabase project URL or a local development endpoint.",
    );
  const key = modern || legacy!;
  if (key.startsWith("sb_publishable_") && key.length > 20)
    return { url: parsed.origin, key };
  try {
    const part = key.split(".")[1];
    const claims = JSON.parse(
      atob(part.replaceAll("-", "+").replaceAll("_", "/")),
    );
    if (key.split(".").length === 3 && claims.role === "anon")
      return { url: parsed.origin, key };
  } catch {
    /* Values are deliberately never included in errors. */
  }
  throw new Error(
    "Only a public publishable or anon key may be used in frontend configuration. Never use a secret or service-role key.",
  );
}

export function assertNoPrivateFrontendKeys(
  env: Record<string, string | undefined>,
) {
  for (const [name, configured] of Object.entries(env)) {
    const value = configured?.trim();
    if (!name.startsWith("VITE_") || !value) continue;
    let privateRole = false;
    try {
      privateRole =
        JSON.parse(
          atob(value.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
        ).role === "service_role";
    } catch {
      /* Not a JWT. */
    }
    if (
      /SERVICE_ROLE|SECRET|PASSWORD|AI_API_KEY/.test(name) ||
      value.startsWith("sb_secret_") ||
      value.startsWith("sk-") ||
      privateRole
    )
      throw new Error(
        "Private credentials are forbidden in VITE_ variables. Remove them from frontend build settings.",
      );
  }
}
export function verifyDevelopmentFrontendTarget(
  env: Record<string, string | undefined>,
) {
  const url = env.VITE_SUPABASE_URL;
  if (!url) return;
  if (
    env.VITE_DAWACARE_ENVIRONMENT === "development" ||
    ["deploy-preview", "branch-deploy"].includes(env.CONTEXT ?? "")
  ) {
    const host = new URL(url).hostname;
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(host) &&
      (!env.VITE_DAWACARE_DEVELOPMENT_PROJECT_REF ||
        host !== `${env.VITE_DAWACARE_DEVELOPMENT_PROJECT_REF}.supabase.co`)
    )
      throw new Error(
        "A separate development Supabase project ref is required for this preview build. Do not inherit production project settings.",
      );
  }
}
