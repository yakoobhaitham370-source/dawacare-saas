import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const input = z.object({ invitation_id: z.string().uuid() });
export default async (req: Request) => {
  const response = (status: number, body: unknown) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (req.method !== "POST")
    return response(405, { error: "Method not allowed" });
  const origin = process.env.SITE_URL;
  if (!origin || req.headers.get("origin") !== new URL(origin).origin)
    return response(403, { error: "Forbidden" });
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return response(503, { error: "Invitation service is not configured" });
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return response(401, { error: "Authentication required" });
  const server = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await server.auth.getUser(token);
  if (authError || !auth.user)
    return response(401, { error: "Authentication required" });
  if (Number(req.headers.get("content-length") ?? 0) > 4096)
    return response(413, { error: "Request too large" });
  let parsed;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return response(413, { error: "Request too large" });
    parsed = input.parse(JSON.parse(raw));
  } catch {
    return response(400, { error: "Invalid request" });
  }
  const { data: invite, error } = await server
    .from("pharmacy_invitations")
    .select("*")
    .eq("id", parsed.invitation_id)
    .single();
  // Only the verified initiating user may deliver this outbox record. Permission was checked by the transaction that created it.
  if (
    error ||
    !invite ||
    invite.invited_by !== auth.user.id ||
    !["pending", "failed"].includes(invite.status) ||
    new Date(invite.expires_at) < new Date()
  )
    return response(403, { error: "Invitation unavailable" });
  // Revalidate privileges at delivery time; revocation must take effect immediately.
  const scoped = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: admin } = await scoped.rpc("is_platform_admin");
  const { data: role } = await scoped.rpc("member_role", {
    p_id: invite.pharmacy_id,
  });
  if (!admin && (role !== "owner" || invite.role === "owner"))
    return response(403, { error: "Forbidden" });
  // Atomic status claim prevents concurrent delivery. On failure preserve the tenant and retryable invitation.
  const { data: claimed } = await server
    .from("pharmacy_invitations")
    .update({ status: "sent" })
    .eq("id", invite.id)
    .in("status", ["pending", "failed"])
    .select("id");
  if (!claimed?.length)
    return response(409, { error: "Invitation already being delivered" });
  const sent = await server.auth.admin.inviteUserByEmail(invite.email, {
    redirectTo: `${new URL(origin).origin}/accept-invitation`,
  });
  if (sent.error || !sent.data.user) {
    await server
      .from("pharmacy_invitations")
      .update({ status: "failed" })
      .eq("id", invite.id);
    return response(502, {
      error: "Delivery failed. The invitation remains reserved for retry.",
    });
  }
  const saved = await server
    .from("pharmacy_invitations")
    .update({ provider_user_id: sent.data.user.id })
    .eq("id", invite.id);
  if (saved.error)
    return response(502, {
      error: "Invitation delivery requires administrator reconciliation.",
    });
  return response(200, { status: "sent" });
};
