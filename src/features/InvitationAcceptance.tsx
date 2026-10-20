import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Field, Input, Spinner } from "@fluentui/react-components";
import { useAuth } from "../app/context";
import { supabase } from "../lib/data";
import { Heading, Notice } from "../components/common";
type Invitation = {
  id: string;
  pharmacy_name: string;
  role: string;
  status: string;
  expires_at: string;
};
export function InvitationAcceptance() {
  const auth = useAuth();
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [passwordSaved, setPasswordSaved] = useState(false);
  const invitations = useQuery({
    queryKey: ["pending-invitations", auth.user],
    enabled: !!supabase && auth.ready && !!auth.user && !auth.scope.sandbox,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("my_pending_invitations");
      if (error)
        throw new Error(
          "Unable to load invitations. Check the development migrations and try again.",
        );
      return data as Invitation[];
    },
    retry: false,
  });
  async function accept(id: string) {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    setPasswordSaved(false);
    try {
      if (password) {
        if (password.length < 12)
          throw new Error("Use a password with at least 12 characters.");
        const update = await supabase.auth.updateUser({ password });
        if (update.error)
          throw new Error(
            "Password could not be updated. Use a fresh recovery link if reauthentication is required.",
          );
      }
      const { error } = await supabase.rpc("accept_pharmacy_invitation", {
        p_id: id,
      });
      if (error)
        throw new Error(
          "Invitation could not be accepted. It may be expired, revoked, or blocked by subscription limits. Contact your pharmacy owner.",
        );
      location.assign("/app/dashboard");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand" to="/">
          <img src="/icon.svg" alt="" />
          DawaCare
        </Link>
        <Heading
          title="Accept your pharmacy invitation"
          subtitle="Confirm the pharmacy and role before joining."
        />
        {!auth.ready ? (
          <Spinner label="Verifying your invitation session…" />
        ) : !supabase ? (
          <Notice>
            Supabase is not configured. Invitation activation requires a
            connected development project.
          </Notice>
        ) : !auth.user ? (
          <>
            <Notice>
              Your email link may be expired or already used. Sign in to an
              existing verified account to view its pending invitations, or ask
              the pharmacy owner to retry the invitation. Links and reservations
              have separate expiry times.
            </Notice>
            <Link to="/login">Sign in</Link>
            <Link to="/forgot-password">Recover your account</Link>
          </>
        ) : (
          <>
            {invitations.isLoading && (
              <Spinner label="Loading your invitations…" />
            )}
            {invitations.error && (
              <Notice error>{invitations.error.message}</Notice>
            )}
            {invitations.data?.length === 0 && (
              <Notice>
                No pending invitation is available for this verified email. If
                you already joined, continue to your workspace. Otherwise ask
                the owner to renew the invitation.
              </Notice>
            )}{" "}
            <Field label="Set or update password (optional, at least 12 characters)">
              <Input
                type="password"
                autoComplete="new-password"
                minLength={12}
                value={password}
                onChange={(_, d) => setPassword(d.value)}
              />
            </Field>
            <Button
              disabled={busy || password.length < 12}
              onClick={async () => {
                if (!supabase) return;
                setBusy(true);
                setMessage("");
                setPasswordSaved(false);
                try {
                  const result = await supabase.auth.updateUser({ password });
                  if (result.error) throw result.error;
                  setPassword("");
                  setPasswordSaved(true);
                  setMessage(
                    "Account password updated. Accept a pharmacy invitation below, or continue after administrator bootstrap.",
                  );
                } catch {
                  setMessage(
                    "Unable to update the password. Use a fresh recovery link if reauthentication is required.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Set account password
            </Button>
            {invitations.data?.map((inv) => (
              <section className="medication-review" key={inv.id}>
                <h2>{inv.pharmacy_name}</h2>
                <p>
                  Role: {inv.role}
                  <br />
                  Reservation expires:{" "}
                  {new Date(inv.expires_at).toLocaleString(undefined, {
                    timeZone: "Asia/Baghdad",
                  })}{" "}
                  (Baghdad)
                </p>
                <Button
                  appearance="primary"
                  disabled={busy || (!!password && password.length < 12)}
                  onClick={() => void accept(inv.id)}
                >
                  Accept invitation to {inv.pharmacy_name}
                </Button>
              </section>
            ))}
            <Link to="/app/dashboard">Continue to workspace</Link>
            <Button
              disabled={busy}
              onClick={async () => {
                try {
                  await auth.signout();
                } catch {
                  setMessage("Unable to sign out. Try again when connected.");
                }
              }}
            >
              Sign out
            </Button>
          </>
        )}
        {message && <Notice error={!passwordSaved}>{message}</Notice>}
      </section>
    </main>
  );
}
export function ResetPassword() {
  const auth = useAuth();
  const [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Heading
          title="Choose a new password"
          subtitle="Use the recovery link from your email."
        />
        {!auth.ready ? (
          <Spinner label="Verifying recovery session…" />
        ) : !auth.user ? (
          <>
            <Notice>
              The recovery link is expired, invalid or already used. Request a
              new one.
            </Notice>
            <Link to="/forgot-password">Request a fresh recovery link</Link>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!supabase) return;
              setBusy(true);
              setMessage("");
              try {
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                setMessage(
                  "Password updated. You can continue to your workspace.",
                );
              } catch {
                setMessage(
                  "Unable to update password. Use a fresh recovery link and meet the project password policy.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="New password (at least 12 characters)" required>
              <Input
                type="password"
                minLength={12}
                required
                value={password}
                onChange={(_, d) => setPassword(d.value)}
                autoComplete="new-password"
              />
            </Field>
            <Button appearance="primary" type="submit" disabled={busy}>
              Update password
            </Button>
          </form>
        )}
        {message && <Notice>{message}</Notice>}
        <Link to="/app/dashboard">Continue to workspace</Link>
      </section>
    </main>
  );
}
