# Founder setup manual

For the current integration task, use the exact [new development project checklist](SUPABASE_DEVELOPMENT_SETUP.md). The existing Netlify production site must remain unchanged. No separate development credentials are configured in this workspace. These are external dashboard actions for you to perform when you are ready. You can keep testing the synthetic workspace in the meantime. Do not use real patient records until the release gates in SECURITY.md are closed.

## 1. Create Supabase

1. Sign in at https://supabase.com/dashboard and create an organization and a project. Choose the hosting region only after considering Iraqi privacy, cross-border processing, and data-residency requirements with qualified advice.
2. Use a unique strong database password and store it in your password manager. Never paste it into chat or a source file.
3. Wait for the database to finish provisioning.
4. In the project's API settings, copy its project URL and public publishable/anon client key into your secure environment settings as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The client supports the public key; it must never receive a service-role key.
5. In Supabase Authentication settings, **disable Allow new users to sign up**. Configure email confirmation, password policy, invitation expiration, rate limits, CAPTCHA where appropriate, and an SMTP provider with verified delivery. Password recovery responses should remain generic.
6. Set the authentication Site URL to the eventual application origin. Add your development and production `/accept-invitation` URLs to the allowed redirect list. Avoid broad wildcard redirects in production.

## 2. Apply the schema to a new development project

1. Read DATABASE.md. Take and verify a backup before changing any database that contains data.
2. For a new empty development project, open its SQL Editor and execute each file under `supabase/migrations` in filename order. Each core migration has a transaction. Do not paste all scripts into an existing production database blindly or reapply non-idempotent migrations.
3. Alternatively, use the official Supabase CLI migration workflow in a separate approved deployment step. Link the exact development project and inspect pending migrations before pushing.
4. Run the hosted integration and security acceptance scenarios before using real data. Local PGlite tests are useful PostgreSQL evidence but do not verify the Supabase gateway, Auth service or Storage service.

## 3. Bootstrap your SaaS administrator

1. Keep public signup disabled. In Supabase Authentication, invite your own administrator email. Open the link, verify the account and use **Set account password** on the connected invitation screen, even without a pharmacy invitation. Do not promote an account based on browser metadata.
2. After your user exists, copy its UUID from the Auth dashboard (the UUID is an identifier, not a secret).
3. Open `supabase/admin/bootstrap-super-admin.sql`, replace its UUID placeholder with your verified Auth UUID, and run it in the NEW development project's SQL Editor. It refuses a second initial bootstrap and records an audit event. Never expose administrator promotion as a public endpoint.
4. Restart the app after setting the public Vite variables and sign in through the emailed invitation. Set a password of at least 12 characters.
5. Open the administrator workspace and enroll a TOTP authenticator when prompted. Verify the six-digit code. Platform database administration requires an `aal2` session; a first-factor session cannot edit plans or provision pharmacies.
6. Store account recovery material securely and validate your recovery procedure before commercial use.

## 4. Configure Netlify server secrets

1. Create a separate Netlify development site using SUPABASE_DEVELOPMENT_SETUP.md. Leave the existing production site unchanged. Do not publish patient data or sandbox browser storage.
2. In Netlify's secure environment-variable settings, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SITE_URL` (the exact frontend origin).
3. Set `VITE_SUPABASE_URL` and ONE public key variable: `VITE_SUPABASE_PUBLISHABLE_KEY` or legacy `VITE_SUPABASE_ANON_KEY`. Set the explicit development flags/reference pairs in `.env.example` and the new setup guide. Rebuild when public build variables change.
4. Obtain the server service key from the Supabase dashboard and enter it **only** into Netlify's secret settings. Never put it in a `VITE_` variable, a commit, a screenshot, or chat. Rotate it immediately if exposed.
5. The functions check the request origin and verify the signed-in user before privileged work. Run the hosted tests for invitations and documents; build success does not test email or storage.
6. For local full-stack testing use the official Netlify CLI's development server after configuring a separate development project's server variables securely. `npm run dev` alone serves Vite and cannot run Netlify Functions.

## 5. Create your first pharmacy

1. Sign in with administrator MFA, open **Plans**, and create plans with your approved names, IQD prices, staff seats, patient limits, and AI allowances. Recommended initial names are Trial, Basic, Professional and Enterprise; names/prices are editable. No commercial prices are silently chosen for you.
2. Open **Pharmacies** and fill in pharmacy name, city, phone, owner email, active plan, and dates.
3. Submit **Create pharmacy & invite owner**. The database creates the tenant, subscription and a reserved owner invitation transactionally.
4. If email delivery fails, the tenant and invitation remain recoverable. The response includes the reserved invitation identifier. Do not create a duplicate tenant to retry email. The invitation recovery panel supports retries, stale leases, revocation and seat-checked renewal; live delivery still needs development-project verification.
5. The owner opens the emailed link, chooses a password and activates their verified invitation. Check that only that pharmacy's records are available.
6. The owner opens **Team**, enters the staff email, selects pharmacist or technician, and sends an invitation. Pending/delivering/sent/failed invitations reserve seats for 48 hours. Expired reservations are marked expired during subsequent preparation; renewing checks limits again. Existing verified accounts receive a login link and explicitly choose which pharmacy to join.
7. Test a second pharmacy and malicious cross-tenant requests before production.

## 6. AI setup (optional; manual entry remains available)

1. Read AI_INTEGRATION.md and obtain appropriate patient consent and a provider data-processing agreement before sending clinical information externally.
2. Create an approved OpenAI API project and spending budget. In Netlify's server settings set `AI_PROVIDER=openai`, `AI_MODEL` to a current multimodal model supporting strict JSON-schema chat-completion output, and `AI_API_KEY` securely.
3. Confirm current provider documentation, regional availability, pricing and model support. No model is hardcoded or assumed free.
4. Assign a deliberately small subscription AI allowance. The database enforces a per-pharmacy monthly allowance and at most five reservations per minute. Failed attempts consume allowance to prevent abuse.
5. Test bilingual text and an image using synthetic examples first. Check review warnings, no persistence before confirmation, and failed-provider behavior. Live connectivity has not yet been verified.

## 7. Manage subscriptions and payments

1. Use **Subscriptions** to set an active plan, start/end dates and account limits. The database enforces explicit status transitions.
2. Expired or suspended accounts cannot write clinical records. Existing records remain readable/exportable to authorized members for 90 days after subscription end. Grace-period writes last at most seven days after end. There is no automatic patient deletion. These are the current fixed implementation defaults; configurable retention remains a release gate.
3. Enter invoices in **Invoices** and record cash, transfer or wallet receipts in **Payments**. The initial record is unconfirmed.
4. Independently verify the money was received, then use **Confirm received payment**. The database records the administrator and timestamp; a paid invoice does not automatically extend a subscription.
5. Revenue-recognition analytics, discounts, billing intervals and full renewal automation remain roadmap items.

## 8. Updates, logs and recovery

1. Work in a development project and branch, run all checks, review migrations and security changes, and back up before release. Never reset production data to fix a test.
2. Review Netlify function error status and Supabase service logs. Do not enable request-body logging of clinical information or keys.
3. Use the in-app audit trail for record/action identifiers and actor timestamps. Patient contents are deliberately excluded from generic logs. Full before/after clinical correction audit and record-filtered activity UI remain release gates.
4. Configure Supabase backups/PITR suitable for your plan. Back up private Storage objects separately: a database backup alone does not restore file bytes.
5. Restore into a separate project, apply matching Auth and Storage configuration, and verify two-tenant isolation, document access, row counts and dispensing history. Record recovery time and data-loss limits. Never claim recovery tested until this drill is actually completed.
6. If login fails, check signup/redirect settings, invitation expiration, membership status and subscription dates. If the UI says service unavailable, check Netlify server variables and function deployment. Do not bypass RLS to make an error disappear.
