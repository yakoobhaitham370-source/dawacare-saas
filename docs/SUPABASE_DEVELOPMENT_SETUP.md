# Connect the existing DawaCare application to a NEW development project

Do not change `stunning-crumble-7aa0db.netlify.app`, its production settings, or a database containing real patient information. This branch adds integration fixes to baseline `6d63daa50151c4f64e77fcfb637eb1765f43bb81`; it does not rebuild the application. Do not merge or deploy to production to perform this guide.

## 1. Create a separate Supabase development project (Supabase dashboard)

1. Open https://supabase.com/dashboard. Create a new project named `DawaCare Development`. Store its generated database password securely in your password manager.
2. In **Project Settings → General**, record the project reference. In the project's **Connect / API settings**, find the project URL and **publishable** key (or legacy public `anon` key). Dashboard labels can vary; the project URL and reference must describe this new project.
3. In **Authentication → Sign In / Providers**, disable **Allow new users to sign up** and anonymous sign-ins. Disable signup for the Email provider as well if a separate switch is shown. A hidden signup page is insufficient.
4. In **Authentication → Security and Protection / MFA**, enable TOTP enrollment and verification. Set a password minimum of at least 12 characters, enable refresh-token rotation, and review auth rate limits/CAPTCHA and session expiry for your plan.
5. In **Authentication → URL Configuration**, set the development Site URL to `http://localhost:8888` initially. Add the exact callback URLs `http://localhost:8888/accept-invitation` and `http://localhost:8888/reset-password`. Later add the equivalent URLs on the separate development Netlify origin. Do not add the production origin to this development project. Do not use a wildcard host.
6. In **Authentication → Email / SMTP**, configure a verified development SMTP sender before testing owners/staff outside your organization. Supabase's default sender may only deliver to permitted organization addresses. Set the email-link expiry deliberately; the example local configuration uses one hour. The application reserves invitation seats for 48 hours independently. Resending makes a fresh Auth link; it does not automatically extend the reservation.
7. Confirm these settings through the actual Auth service when running the integration suite. A saved dashboard switch or local TOML file is not evidence that a hosted project is configured.

## 2. Apply migrations once (new development database only)

1. Check out `dev/supabase-integration` and run `npm ci`. Use Node.js 24 LTS.
2. In the NEW project's SQL Editor, execute the following files **in order**, each as a separate query:
   - `supabase/migrations/202610200001_core.sql`
   - `supabase/migrations/202610200002_invitations_and_safety.sql`
   - `supabase/migrations/202610200003_storage.sql`
   - `supabase/migrations/202610200004_ai.sql`
   - `supabase/migrations/202610200005_staff.sql`
   - `supabase/migrations/202610200006_documents.sql`
   - `supabase/migrations/202610200007_integration_hardening.sql`
   - `supabase/migrations/202610200008_invitation_lifecycle.sql`
   - `supabase/migrations/202610200009_dispensing_replay_integrity.sql`
3. These scripts use transactions and are versioned migrations, not repeatable reset scripts. Existing development databases with migrations 1–6 already applied need only 7–9. Do not reapply the old scripts. If a constraint rejects existing bad development records, investigate them; do not disable RLS/constraints or delete records to silence the error.
4. For CLI-managed projects, use the official CLI migration ledger instead of mixing manual and CLI application. Link **only** this new development reference, inspect `supabase migration list`, then apply reviewed pending migrations. Never run `supabase db reset --linked` or link this checkout to production.
5. In SQL Editor, mark the NEW project as a development test target (replace the reference; no secrets are in this query):

```sql
insert into public.platform_settings(key,value)
values ('environment','development'),
       ('integration_project_ref','YOUR_NEW_DEVELOPMENT_PROJECT_REF')
on conflict(key) do update set value=excluded.value;
```

These markers are checked before the remote integration suite creates fixtures. Do not mark a production database as development.

## 3. Configure local development securely (Windows or cloud settings)

1. On Windows, copy `.env.example` to **`.env.local`** in the repository. Edit the ignored `.env.local` on your own machine; never commit it. In a cloud task, use the environment's secure variable/secret settings instead. Never paste privileged values into chat or screenshots.
2. Set the public browser values:

| Name                                    | Value / location                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`                     | The NEW project's HTTPS URL                                                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY`         | Its public publishable key                                                           |
| `VITE_SUPABASE_ANON_KEY`                | Leave blank when using the publishable key; otherwise use its legacy public anon key |
| `VITE_DAWACARE_ENVIRONMENT`             | `development`                                                                        |
| `VITE_DAWACARE_DEVELOPMENT_PROJECT_REF` | The NEW project reference                                                            |

3. Set server values in the same private local file (they are NOT exposed through Vite):

| Name                               | Value / location                                                      |
| ---------------------------------- | --------------------------------------------------------------------- |
| `SUPABASE_URL`                     | Same NEW project's HTTPS URL                                          |
| `SUPABASE_SERVICE_ROLE_KEY`        | NEW project's server secret/service-role key from secure API settings |
| `SITE_URL`                         | `http://localhost:8888` for local full-stack development              |
| `DAWACARE_ENVIRONMENT`             | `development`                                                         |
| `DAWACARE_DEVELOPMENT_PROJECT_REF` | Same NEW reference                                                    |

4. Never use a server key in any `VITE_` variable. The build rejects private key names/values and rejects previews without an explicit matching development reference. The API rejects a development `SITE_URL` pointing to the existing production origin.
5. Run `npm run dev:full`. It pins Netlify CLI and uses `--offline --no-open`, so it does not fetch a linked production site's settings. Vite alone (`npm run dev`) does not serve `/api/*` functions. The Netlify CLI must be allowed to install from npm on first use.
6. On your own Windows computer, open `http://localhost:8888`. Sign in through the connected path. The synthetic sandbox remains separate and needs no keys. Do not use the synthetic workspace for real records.
7. Restart the dev server after changing private settings. Rebuild a frontend after changing public build variables.

## 4. Bootstrap the first administrator without a public signup endpoint

1. In **Supabase → Authentication → Users**, use **Invite user** for your own development administrator email. Open that email and verify the account. On the connected invitation screen, set a strong password with **Set account password**, even when no pharmacy invitation is listed. Public registration stays disabled.
2. Copy its Auth user UUID from the dashboard. Do not substitute an email or a browser metadata role.
3. Open `supabase/admin/bootstrap-super-admin.sql`, replace its one UUID placeholder, and run it only in the NEW project's SQL Editor. It requires a verified user, refuses a second initial bootstrap, and records an administrative audit event.
4. Refresh the app after bootstrap and sign in to DawaCare. The admin route sends a first-factor session to the authenticator screen. Set up TOTP and verify the six-digit code. Database platform operations require an actual `aal2` JWT; changing a frontend role cannot grant access.
5. If enrollment was interrupted, **Set up authenticator** restarts only abandoned, unverified DawaCare enrollments. It never removes a verified factor automatically. Record your secure recovery procedure.
6. Lost verified factors require an authorized Supabase dashboard recovery and audit. Password reset does not bypass MFA. Do not delete the RLS MFA check or expose an admin-promotion endpoint.

## 5. Test tenant and invitation onboarding

1. In **Plans**, create a development plan: editable name, IQD currency, zero test price, three seats, ten patients, and zero AI requests. Use synthetic data only.
2. In **Pharmacies**, create synthetic Pharmacy A and Pharmacy B, each with an owner email under your control and valid subscription dates.
3. Creation commits the tenant, subscription and invitation reservation together. Email happens afterward. If sending fails, keep the tenant and retry its existing invitation from **Invitation delivery & recovery**. Do not recreate the pharmacy.
4. New users receive an Auth invitation. Existing users receive a one-time login link with account creation disabled, so an existing verified account can join another independently authorized pharmacy.
5. After email verification/sign-in, the invitation page lists that verified email's pending organizations and roles. Explicitly accept one invitation. Existing accounts do not have to reset their password. A password can be set/updated if desired; account recovery has its own `/reset-password` route.
6. The owner invites one pharmacist and one technician from **Team**. Reservations count toward the seat limit while pending, delivering, failed or sent. A fourth active/reserved user must be denied server-side.
7. Delivery is leased for two minutes. Concurrent sends are rejected, stale leases are recoverable, sends have a 60-second cooldown and a ten-attempt cap per reservation. An authorized current owner/admin can retry another sender's invitation. Renew an expired/revoked reservation only after the seat limit is checked again; or revoke it to release the seat.
8. Acceptance rechecks verified email, current inviter authorization, subscription dates/status, seat count and existing membership. It cannot promote/reactivate an existing member. Use **Team** to manage existing staff. Repeated acceptance returns without creating another membership; a revoked/expired invitation cannot activate.
9. Register a synthetic patient in each pharmacy, add independent medicines, dispense twice, record contact outcomes, and reload. Test records must persist in Supabase, not `dawacare.synthetic.v1`.
10. Test Pharmacy A JWTs against Pharmacy B's patient, medicine, dispensing, contact, document and membership API requests; expect denied writes/empty authorized reads. Technicians cannot finalize clinical dispensing. A platform administrator without pharmacy membership cannot read clinical records.

## 6. Private documents and function health

1. Add a synthetic PNG/JPEG/PDF up to 5 MB to a synthetic patient through the connected workspace. File signatures and size are checked before a private service upload. A server-only RPC registers metadata for the verified caller; clients cannot fabricate registration rows.
2. Request an authorized download. Links last 60 seconds. Cross-tenant metadata reads, private object reads and link creation must fail. Archive the record and verify no new link can be issued. Already-issued bearer URLs can remain valid until expiry; do not claim instant revocation of an issued URL.
3. Configure the full-stack development server before testing. `GET /api/health` without a JWT returns 401. A verified admin JWT with MFA is required to check actual Auth signup settings, bucket privacy and invitation migration columns. The health result exposes statuses only, never keys.
4. A function returning SPA HTML or a platform 404 is not deployed/working. `GET /api/invite` and `GET /api/documents` should return 405 JSON. Follow authenticated tests before claiming successful persistence or email.
5. File-signature checks are not malware scanning. Quarantine/scanning and orphan cleanup after a process crash remain release work. Registration failure requests upload cleanup but cannot guarantee cleanup if the process or storage service is unavailable.

## 7. Use a separate Netlify development site (not the existing production site)

1. In Netlify, create a **new site** imported from this repository and set its deploy branch to `dev/supabase-integration`. Leave `stunning-crumble-7aa0db` unchanged. A primary deployment on a separate development site can still be called the `production` deploy context by Netlify; use the explicit DawaCare development flags below.
2. Build command: `npm run build`; publish directory: `dist`; functions: `netlify/functions`; Node.js 24 LTS. The existing `netlify.toml` supplies redirects and security headers.
3. In the NEW site's **Project configuration → Environment variables**, add the public `VITE_*` values above to **Builds** scope, and server values to **Functions** scope. If scope controls are unavailable on your plan, the `VITE_` prefix distinction still matters: never give server secrets that prefix. Do not copy production keys or inherit production context values.
4. Change `SITE_URL` to this new site's exact HTTPS origin. Keep both development flags/reference pairs set to the NEW Supabase reference. Add that origin's two callback URLs in the NEW Supabase project's allowed redirects, and select the desired development email Site URL.
5. Review and deploy only to this separate development site when ready. Creating/pushing this branch or its PR does not authorize a production deployment. The code's deploy-preview guard fails closed if a preview inherits a connected URL without a matching development reference.
6. Run authenticated development acceptance tests. The agent has not configured or deployed your Netlify site or entered any secret for you.

## 8. Run the real integration suite safely

1. Copy `.env.integration.example` to **`.env.integration.local`** (ignored). Fill it securely with the NEW project URL, public key, server key, reference and an owned test mailbox domain. Set the two explicit development/write-confirmation flags exactly as shown in the example.
2. From **Supabase → Connect**, obtain the NEW project's database connection string. Use a direct or **Session pooler** connection compatible with your network (session pooler can help with IPv4-only networks). Set `DAWACARE_TEST_DATABASE_URL` privately and use `sslmode=verify-full`. Never disable TLS verification to solve connectivity issues. Configure the official CA trust if your environment requires it.
3. Confirm the two development database markers from step 2. The suite checks them before remote writes. Never set these test markers on production. Use a test-only mailbox domain you control; hosted invitation checks can send development email.
4. For deployed-function tests set `DAWACARE_TEST_NETLIFY_URL` to the separate development origin. The suite explicitly rejects `https://stunning-crumble-7aa0db.netlify.app`.
5. Run `npm run test:integration`. It creates UUID-tagged synthetic users, requires real TOTP MFA for its temporary platform admin, provisions tenants, tests Auth signup denial, limits, persistent clinical records, tenant isolation, private files and staff suspension, then cleans up only its tracked fixture IDs. It never resets a database.
6. Without a development Netlify URL, the suite calls the same function handlers in Node against the supplied real Supabase project. That tests backend code and Supabase services, **not** Netlify deployment/routing. With the development URL, it calls the deployed authenticated endpoints instead.
7. A missing target produces `BLOCKED` before test execution. A passing local/PGlite suite is not a hosted integration pass. Review cleanup failures and remove only identified synthetic fixture IDs; never run a blanket production reset.

## 9. Optional isolated Docker stack

Use the official Supabase CLI with `supabase/config.toml`. Local Auth signup is disabled, TOTP is enabled, seed execution is off, and the default PostgreSQL major version is 17. No hosted project is linked. Allow generous Docker disk space (the 32 GB cloud workspace could not extract the official PostgreSQL images during this segment), and check resources before starting.

The CLI 2.75.0 binary used during investigation was downloaded from the official release and checked against its published SHA-256. The environment's newer CLI could not initialize its standard settings path on the read-only home filesystem. Do not change `HOME` or disable artifact/TLS verification to work around setup errors.

If your policy blocks the default `public.ecr.aws` image registry, the CLI's documented `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` mirror can be used where permitted. Do not disable health checks to label a broken stack ready.

For a functioning local stack, privately capture `supabase status --output json` to a local ignored file and set `DAWACARE_LOCAL_STATUS_FILE` to it before `npm run test:integration`. Do not print, commit, upload or paste that status file: it contains local credentials. The loader accepts only a loopback API and a loopback database. Local success still does not prove hosted Supabase/Netlify behavior.
