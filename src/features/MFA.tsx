import { useEffect, useState } from "react";
import { Button, Field, Input } from "@fluentui/react-components";
import { supabase } from "../lib/data";
import { Heading, Notice } from "../components/common";
export function MFA() {
  const [factor, setFactor] = useState(""),
    [qr, setQR] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp.find((f) => f.status === "verified");
      if (verified) setFactor(verified.id);
    });
  }, []);
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Heading
          title="Administrator verification"
          subtitle="A second authentication factor is required for platform administration."
        />
        {!factor && (
          <Button
            onClick={async () => {
              if (!supabase) return;
              const { data, error } = await supabase.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: "DawaCare administrator",
              });
              if (error) {
                setError(
                  "Unable to enroll an authenticator. Review existing factors in Supabase.",
                );
                return;
              }
              setFactor(data.id);
              setQR(data.totp.qr_code);
            }}
          >
            Set up authenticator
          </Button>
        )}
        {qr && (
          <>
            <p>
              Scan this QR code with your authenticator app. Keep recovery
              access secure.
            </p>
            <img src={qr} alt="Authenticator enrollment QR code" width={220} />
          </>
        )}
        {factor && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!supabase) return;
              const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: factor,
                code,
              });
              if (error) setError("Verification failed. Try a fresh code.");
              else location.assign("/admin/dashboard");
            }}
          >
            <Field label="Six-digit authenticator code" required>
              <Input
                value={code}
                onChange={(_, d) => setCode(d.value)}
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
              />
            </Field>
            <Button type="submit" appearance="primary">
              Verify
            </Button>
          </form>
        )}
        {error && <Notice error>{error}</Notice>}
      </section>
    </main>
  );
}
