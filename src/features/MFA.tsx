import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button, Field, Input, Spinner } from "@fluentui/react-components";
import { supabase } from "../lib/data";
import { useAuth } from "../app/context";
import { Heading, Notice } from "../components/common";
export function MFA() {
  const auth = useAuth();
  const [factor, setFactor] = useState(""),
    [qr, setQR] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!!supabase),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.mfa
      .listFactors()
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setError("Unable to load authenticators. Sign in again or retry.");
        else {
          const verified = data?.totp.find((f) => f.status === "verified");
          if (verified) setFactor(verified.id);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setError("Unable to load authenticators.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  if (auth.ready && !auth.user && !auth.scope.sandbox)
    return <Navigate to="/login" replace />;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Heading
          title="Administrator verification"
          subtitle="A second authentication factor is required for platform administration."
        />
        {loading && <Spinner label="Checking authenticators…" />}
        {!factor && (
          <Button
            disabled={!supabase || loading || busy || auth.scope.sandbox}
            onClick={async () => {
              if (!supabase) return;
              setBusy(true);
              setError("");
              try {
                const factors = await supabase.auth.mfa.listFactors();
                if (factors.error) throw factors.error;
                const verified = factors.data.totp.find(
                  (f) => f.status === "verified",
                );
                if (verified) {
                  setFactor(verified.id);
                  return;
                }
                // Explicit setup restarts only our abandoned unverified enrollments. Never
                // remove a verified factor or provide a first-factor-only MFA bypass.
                for (const stale of factors.data.all.filter(
                  (f) =>
                    f.factor_type === "totp" &&
                    f.status === "unverified" &&
                    f.friendly_name === "DawaCare administrator",
                )) {
                  const removed = await supabase.auth.mfa.unenroll({
                    factorId: stale.id,
                  });
                  if (removed.error) throw removed.error;
                }
                const { data, error } = await supabase.auth.mfa.enroll({
                  factorType: "totp",
                  friendlyName: "DawaCare administrator",
                });
                if (error) throw error;
                setFactor(data.id);
                setQR(data.totp.qr_code);
              } catch {
                setError(
                  "Unable to set up an authenticator. Retry or review factors in the development Supabase dashboard.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Set up authenticator
          </Button>
        )}
        {qr && (
          <>
            <p>
              Scan this QR code in your authenticator app. Store account
              recovery access securely.
            </p>
            <img src={qr} alt="Authenticator enrollment QR code" width={220} />
          </>
        )}
        {factor && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!supabase) return;
              setBusy(true);
              setError("");
              try {
                const { error } = await supabase.auth.mfa.challengeAndVerify({
                  factorId: factor,
                  code,
                });
                if (error) throw error;
                location.assign("/admin/dashboard");
              } catch {
                setError("Verification failed. Try a fresh six-digit code.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Six-digit authenticator code" required>
              <Input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(_, d) => setCode(d.value)}
              />
            </Field>
            <Button type="submit" appearance="primary" disabled={busy}>
              Verify
            </Button>
          </form>
        )}
        {error && <Notice error>{error}</Notice>}
        <Notice>
          A lost verified factor requires a controlled recovery through the
          Supabase administrator. Password reset alone does not remove the
          database MFA requirement.
        </Notice>
        <Link to="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
