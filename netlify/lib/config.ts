export function serverConfiguration() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY,
    site = process.env.SITE_URL;
  if (!url || !key || !site)
    throw new Error("Server configuration is incomplete");
  const api = new URL(url),
    origin = new URL(site);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname);
  if (!local && api.protocol !== "https:") throw new Error("HTTPS is required");
  const development =
    process.env.DAWACARE_ENVIRONMENT === "development" ||
    ["deploy-preview", "branch-deploy", "dev"].includes(
      process.env.CONTEXT ?? "",
    );
  if (development) {
    if (origin.hostname === "stunning-crumble-7aa0db.netlify.app")
      throw new Error("Use a separate development origin");
    if (
      !local &&
      (!process.env.DAWACARE_DEVELOPMENT_PROJECT_REF ||
        api.hostname !==
          `${process.env.DAWACARE_DEVELOPMENT_PROJECT_REF}.supabase.co`)
    )
      throw new Error("Development project identity is required");
  }
  if (api.username || api.password || origin.username || origin.password)
    throw new Error("Invalid server URLs");
  return { url: api.origin, key, origin: origin.origin, development };
}