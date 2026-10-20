import { useEffect, useState } from "react";
import { Button } from "@fluentui/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../app/context";
import { useRows } from "../lib/hooks";
import { supabase } from "../lib/data";
import { deliverInvitation } from "../services/invitations";
import { DataTable, LoadState, Notice, Status } from "../components/common";
export function InvitationManagement() {
  const { scope } = useAuth();
  const query = useRows("pharmacy_invitations");
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invitation action failed.");
    } finally {
      await cache.invalidateQueries({ queryKey: ["records"] });
      setBusy(false);
    }
  }
  async function manage(id: string, action: string) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const result = await supabase.rpc("manage_invitation", {
      p_id: id,
      p_action: action,
    });
    if (result.error)
      throw new Error(
        "Unable to change this invitation. Check your permissions and available seats.",
      );
  }
  return (
    <section className="panel">
      <h2>Invitation delivery & recovery</h2>
      <p>
        Pending, failed and in-progress invitations reserve seats. Renewing an
        expired reservation checks the seat limit again. Retry delivery instead
        of creating another pharmacy.
      </p>
      {scope.sandbox && (
        <Notice>
          Live invitation actions require the connected development project and
          Netlify Functions.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
        Refresh invitations
      </Button>
      <LoadState loading={query.isLoading} error={query.error} />
      <DataTable
        rows={query.data ?? []}
        columns={[
          { key: "email", label: "Email" },
          { key: "pharmacy_id", label: "Pharmacy" },
          { key: "role", label: "Role" },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Status
                value={
                  r.status === "accepted" || r.status === "revoked"
                    ? r.status
                    : new Date(String(r.expires_at)).getTime() <= now
                      ? "expired"
                      : r.status
                }
              />
            ),
          },
          { key: "expires_at", label: "Reservation expires" },
        ]}
        actions={(r) => {
          if (r.status === "accepted") return null;
          const expired =
            new Date(String(r.expires_at)).getTime() <= now ||
            ["revoked", "expired"].includes(String(r.status));
          const leased =
            r.status === "delivering" &&
            new Date(String(r.delivery_lease_until)).getTime() > now;
          const cooldown =
            r.last_delivery_at &&
            new Date(String(r.last_delivery_at)).getTime() > now - 60000;
          return (
            <>
              {expired ? (
                <Button
                  disabled={scope.sandbox || busy}
                  onClick={() =>
                    void perform(
                      () => manage(r.id, "renew"),
                      "Invitation renewed. Send it when ready.",
                    )
                  }
                >
                  Renew reservation
                </Button>
              ) : (
                <Button
                  disabled={scope.sandbox || busy || leased || !!cooldown}
                  onClick={() =>
                    void perform(
                      () => deliverInvitation(r.id),
                      "Invitation email sent.",
                    )
                  }
                  title={
                    leased
                      ? "Delivery is in progress. A stale lease becomes retryable after two minutes."
                      : cooldown
                        ? "Wait 60 seconds before another delivery."
                        : undefined
                  }
                >
                  {leased
                    ? "Delivery in progress"
                    : r.status === "sent"
                      ? "Resend email"
                      : "Send / retry email"}
                </Button>
              )}
              {r.status !== "revoked" && (
                <Button
                  disabled={scope.sandbox || busy}
                  onClick={() =>
                    void perform(
                      () => manage(r.id, "revoke"),
                      "Invitation revoked and reserved seat released.",
                    )
                  }
                >
                  Revoke invitation
                </Button>
              )}
            </>
          );
        }}
      />
    </section>
  );
}
