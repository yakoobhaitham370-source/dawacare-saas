import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button, Field, Input } from "@fluentui/react-components";
import { useAuth } from "../app/context";
import { supabase, clientConfigurationError } from "../lib/data";
import { Heading, Notice } from "../components/common";
export function Landing({ section = "home" }: { section?: string }) {
  const { enterSandbox } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="public-page">
      <nav className="public-nav">
        <Link className="brand" to="/">
          <img src="/icon.svg" alt="" />
          DawaCare
        </Link>
        <div>
          <Link to="/features">Features</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/login">
            <Button>Sign in</Button>
          </Link>
        </div>
      </nav>
      <main className="landing">
        <span className="eyebrow">BUILT FOR COMMUNITY PHARMACIES</span>
        <h1>
          {section === "pricing"
            ? "Care that grows with your pharmacy."
            : section === "contact"
              ? "Let’s build better continuity of care."
              : "Remember every refill. Care for every patient."}
        </h1>
        <p>
          One calm workspace for chronic medication records, refill follow-up,
          and your pharmacy team. Designed for Iraq. Available in Arabic and
          English.
        </p>
        {section === "pricing" ? (
          <Notice>
            Subscription plans and prices will be published after platform
            configuration. Contact the pharmacy service owner for an invitation;
            there is no public registration.
          </Notice>
        ) : section === "contact" ? (
          <Notice>
            Sales contact details have not been configured. This development
            build does not send or store sales requests.
          </Notice>
        ) : (
          <div className="landing-features">
            <article>
              <h3>Patients, connected</h3>
              <p>A continuous record, from first visit to next refill.</p>
            </article>
            <article>
              <h3>Clear next steps</h3>
              <p>Independent medication schedules and thoughtful follow-up.</p>
            </article>
            <article>
              <h3>A protected workspace</h3>
              <p>
                Invitation-only pharmacy access with database-enforced tenant
                boundaries.
              </p>
            </article>
          </div>
        )}
        <div className="form-actions">
          <Link to="/login">
            <Button appearance="primary" size="large">
              Sign in to your pharmacy
            </Button>
          </Link>
          <Button
            size="large"
            onClick={() => {
              enterSandbox();
              navigate("/app/dashboard");
            }}
          >
            Explore synthetic sandbox
          </Button>
        </div>
        <small>
          Development build · Sandbox uses synthetic records only · Production
          gates remain open
        </small>
      </main>
    </div>
  );
}
export function Login({ reset = false }: { reset?: boolean }) {
  const { user, scope, enterSandbox } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (scope.sandbox || user)
    return (
      <Navigate
        to={
          scope.role === "super_admin" ? "/admin/dashboard" : "/app/dashboard"
        }
        replace
      />
    );
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link className="brand" to="/">
          <img src="/icon.svg" alt="" />
          DawaCare
        </Link>
        <Heading
          title={reset ? "Reset your password" : "Welcome back"}
          subtitle="Your patients’ next step starts here."
        />
        {!supabase && (
          <Notice>
            {clientConfigurationError ||
              "Live sign-in needs Supabase configuration. The synthetic sandbox is available for development."}
          </Notice>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase) return;
            setBusy(true);
            setError("");
            try {
              const result = reset
                ? await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${location.origin}/reset-password`,
                  })
                : await supabase.auth.signInWithPassword({ email, password });
              if (result.error) throw result.error;
              if (reset)
                setMessage(
                  "If this account exists, a reset link will be sent.",
                );
            } catch {
              setError(
                "Unable to complete sign-in. Check your credentials or try again later.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(_, d) => setEmail(d.value)}
              required
              autoComplete="email"
            />
          </Field>
          {!reset && (
            <Field label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(_, d) => setPassword(d.value)}
                required
                autoComplete="current-password"
              />
            </Field>
          )}
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          <Button
            appearance="primary"
            type="submit"
            disabled={!supabase || busy}
          >
            {reset ? "Send reset link" : "Sign in"}
          </Button>
        </form>
        <Link to={reset ? "/login" : "/forgot-password"}>
          {reset ? "Back to sign in" : "Forgot password?"}
        </Link>
        <div className="auth-divider">
          Invitation only. No public registration.
        </div>
        <Button
          onClick={() => {
            enterSandbox();
            navigate("/app/dashboard");
          }}
        >
          Explore synthetic sandbox
        </Button>
      </div>
    </main>
  );
}
export { InvitationAcceptance as AcceptInvitation } from "./InvitationAcceptance";
