import { createClient } from "@supabase/supabase-js";
import { serverConfiguration } from "../lib/config";
import { z } from "zod";
const input = z.object({ invitation_id: z.string().uuid() });
export default async (req: Request) => {
  const reply = (status: number, body: unknown) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  let site: URL;
  try {
    site = new URL(process.env.SITE_URL ?? "");
  } catch {
    return reply(503, { error: "Invitation service is not configured" });
  }
  if (req.headers.get("origin") !== site.origin)
    return reply(403, { error: "Forbidden" });
  let config: ReturnType<typeof serverConfiguration>;
  try {
    config = serverConfiguration();
  } catch {
    return reply(503, {
      error: "Invitation service is not configured for this development target",
    });
  }
  if (req.headers.get("origin") !== config.origin)
    return reply(403, { error: "Forbidden" });
  const { url, key } = config;
  const token = req.headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return reply(401, { error: "Authentication required" });
  const server = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const scoped = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let claim: { id: string; lease: string; email: string } | undefined;
  try {
    const auth = await server.auth.getUser(token);
    if (auth.error || !auth.data.user)
      return reply(401, { error: "Authentication required" });
    if (Number(req.headers.get("content-length") ?? 0) > 4096)
      return reply(413, { error: "Request too large" });
    const raw = await req.text();
    if (raw.length > 4096) return reply(413, { error: "Request too large" });
    let parsed;
    try {
      parsed = input.parse(JSON.parse(raw));
    } catch {
      return reply(400, { error: "Invalid request" });
    }
    const reservation = await scoped.rpc("claim_invitation_delivery", {
      p_id: parsed.invitation_id,
    });
    if (reservation.error)
      return reply(409, {
        error:
          "Invitation unavailable. Check permission, expiry and the retry cooldown.",
      });
    claim = reservation.data as typeof claim;
    if (!claim) throw new Error("Missing delivery lease");
    const recipient = await server.rpc("invitation_recipient", {
      p_id: claim.id,
      p_lease: claim.lease,
    });
    if (recipient.error) throw new Error("Recipient lookup failed");
    let user: string;
    if (recipient.data) {
      // Existing accounts use a one-time login link, not another signup/invite.
      const result = await server.auth.signInWithOtp({
        email: claim.email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${config.origin}/accept-invitation`,
        },
      });
      if (result.error) throw new Error("Delivery failed");
      user = recipient.data as string;
    } else {
      const result = await server.auth.admin.inviteUserByEmail(claim.email, {
        redirectTo: `${config.origin}/accept-invitation`,
      });
      if (result.error || !result.data.user) throw new Error("Delivery failed");
      user = result.data.user.id;
    }
    const finish = await server.rpc("finish_invitation_delivery", {
      p_id: claim.id,
      p_lease: claim.lease,
      p_user: user,
      p_success: true,
    });
    if (finish.error) throw new Error("Delivery reconciliation required");
    // A verified recipient may have accepted while the provider response was in flight.
    return reply(200, { status: "sent" });
  } catch {
    if (claim) {
      try {
        await server.rpc("finish_invitation_delivery", {
          p_id: claim.id,
          p_lease: claim.lease,
          p_user: null,
          p_success: false,
        });
      } catch {
        /* An expired lease can be recovered by the next authorized retry. */
      }
    }
    return reply(502, {
      error:
        "Delivery could not be confirmed. The invitation is recoverable; retry after the cooldown instead of creating another pharmacy.",
    });
  }
};
