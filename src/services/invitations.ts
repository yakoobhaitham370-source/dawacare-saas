import { supabase } from "../lib/data";
export async function deliverInvitation(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session)
    throw new Error("Sign in again before delivering an invitation.");
  const response = await fetch("/api/invite", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invitation_id: id }),
  });
  if (!response.ok) {
    let message =
      "Delivery could not be confirmed. Retry the reserved invitation after the cooldown.";
    try {
      const body = await response.json();
      if (typeof body.error === "string") message = body.error;
    } catch {
      /* A missing function/SPA fallback is not a successful delivery. */
    }
    throw new Error(message);
  }
  const body = await response.json();
  if (body.status !== "sent")
    throw new Error("Invitation delivery was not confirmed.");
}
