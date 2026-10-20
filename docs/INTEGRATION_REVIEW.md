# Supabase development integration review

Date: 2026-10-20 (Asia/Baghdad). Baseline: `6d63daa50151c4f64e77fcfb637eb1765f43bb81`. Branch: `dev/supabase-integration`.

## Baseline and scope

The fetched latest `main` exactly matched the supplied baseline. The working checkout was clean. The existing React/Fluent UI application, synthetic workflows, first six SQL migrations, tests, routes and deployment configuration were preserved. No production migration, deployment, patient-data connection, or change to `stunning-crumble-7aa0db.netlify.app` was made.

The founder confirmed that no separate Supabase development project or Netlify development/preview site is available yet. No Supabase/Netlify credentials were present in the running process or saved environment bindings; only names/presence were inspected. Native GitHub reads worked at the beginning of this task. GitHub API and the specified Netlify origin are blocked by the cloud egress policy; token presence is not treated as missing Git authentication.

## What already worked

- Synthetic patient registration/edit/archive, per-medication treatment records, immutable dispensing history, inclusive refill projections, contact outcomes, laboratory records and exports.
- Fluent UI shell, responsive record cards, English/Arabic navigation, RTL and light/dark themes.
- Composite tenant foreign keys, membership-based RLS, subscription/seat/patient limits, MFA-gated administrative SQL and the initial server function architecture.
- Baseline automated date/domain, policy, endpoint and desktop/mobile workflows. Hosted integration was explicitly unverified in the baseline and remains a separate gate.

## Changes and security fixes

1. Additive migrations 7–9 explicitly revoke unexpected default browser/anonymous privileges and restore only required grants. No old migration was rewritten.
2. Existing patient-document buckets are made private with explicit MIME/size constraints; browser clients cannot fabricate metadata registrations. A service-only function registers uploaded metadata for the JWT-verified actor and revalidates tenant access.
3. Invitation delivery uses a caller-authorized lease, current role/MFA checks, cooldown, attempt cap, recoverable failures and stale-lease recovery. Service-only RPCs finish delivery and resolve the recipient.
4. Existing accounts receive login links with account creation disabled. Verified users explicitly choose which pharmacy to join. Acceptance rechecks email, current inviter, subscription, existing membership and seat limits; it is idempotent and does not promote/reactivate existing members. Another currently authorized sender can recover an older invitation.
5. Owners/admins can refresh, send/retry, revoke and renew invitations from the existing UI. Failed email delivery no longer requires another tenant creation.
6. Password recovery has a separate route. A verified first administrator can set a password even without any pharmacy invitation. A guarded SQL bootstrap script records the initial promotion and never bypasses TOTP. Interrupted unverified enrollment can restart without silently removing verified factors.
7. Authentication state ignores stale user/membership responses, clears cached records on identity changes, clears elevated state on expiration, and makes no auth/membership requests while sandbox mode is active. Auth routes exit a stored sandbox explicitly.
8. Frontend configuration supports public publishable or legacy anon keys and rejects private key names/values. Connected previews and development functions require explicit development identity; the known production origin is rejected as a development function/test target.
9. New patient numbers are immutable, notification preferences are self-scoped, AI job/usage relationships carry matching tenant context, and payment insertion validates invoice currency.
10. Dispensing idempotency compares carry-over, reminder and correction fields as well as the original identity/quantity/dates; changing clinical input cannot silently return an older event.
11. Added authenticated admin/MFA-only `/api/health`, a safety-gated real integration suite, local Supabase configuration with signup disabled/TOTP enabled/no seeds, and the exact secure setup guide.
12. ESLint now ignores generated `.netlify` bundles, while retaining checks on all application/function/test source. This fixes the lint failure exposed by actually starting the local full-stack runtime.

## Validation actually executed

| Check                                                          | Result                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| TypeScript, ESLint, `npm run check`, production Vite/PWA build | Passed                                                                              |
| Unit/component/PostgreSQL-policy/endpoint tests                | **96 passed**, 11 files                                                             |
| Original desktop/mobile Playwright workflows                   | **10 passed**, including 360 px                                                     |
| Netlify CLI Node Function HTTP routing                         | **4 passed**: health returns 401 JSON; invite/documents/extract GET return 405 JSON |
| Production dependency vulnerability audit                      | Zero reported critical/high/moderate/low vulnerabilities                            |
| First six migration contents vs baseline                       | Unchanged                                                                           |
| Real hosted Supabase/Netlify service tests                     | **Not executed: blocked**                                                           |

PostgreSQL policy tests use PGlite with simulated Auth claims/storage tables, including a fixture that grants Supabase-style default privileges before applying migrations. Email transport tests are explicitly mocked. Component tests mock Auth/database responses; JSDOM's missing layout observer is shimmed only for component rendering, while responsive browser behavior is exercised separately. None of these are described as a hosted Auth/email/Storage success.

The local Netlify CLI loaded all four real Node handlers and served the expected method/auth guards over HTTP. Its unused Edge runtime download was blocked; this isolated Node validation used the CLI's internal Edge-disable option. The application has no Edge Functions. The recommended user command remains the standard supported `npm run dev:full`; no internal CLI flag is saved as a product dependency. No authenticated persistence is claimed from the unconfigured HTTP smoke checks.

The production bundle still has a large-chunk warning, already an open performance gate. Route/bundle optimization is outside this integration assignment.

## Blocked checks and attempted diagnosis

- **Hosted Supabase/Auth/SMTP/Storage/MFA:** no separate development project or credentials. `npm run test:integration` was invoked and stopped with `BLOCKED` before test collection or writes. Its eight real-service cases remain unexecuted.
- **Isolated real local Supabase:** the official CLI binary was checksum-verified. The initial newer CLI could not create its settings path on the read-only home filesystem. The standard image registry was denied; the documented Docker Hub mirror was reachable. PostgreSQL 17 and then the supported 15 image extraction exceeded the workspace filesystem limit. Both startup attempts were stopped; no successful Auth/PostgREST/Storage stack is claimed. Final local configuration retains PostgreSQL 17 to match the intended new hosted project.
- **Deployed Netlify:** only unauthenticated, read-only GET checks were attempted against the user-supplied site; egress denied the hostname before reaching it. This is not a claim that the site or functions are broken.
- **GitHub PR API:** native Git reads worked initially, but the final branch push and subsequent read check failed with an upstream HTTPS-tunnel 503. The approved external-network execution path failed identically. API requests are also denied by the network route. A grant of generic network permission did not change the egress proxy decision. Required `api.github.com` and the supplied Netlify hostname were saved as additive custom rules in the cloud configuration draft, preserving package-manager presets; saving a draft does not apply/publish the policy. See the final task report for the branch/PR outcome.

## Next actions for the founder

Follow **SUPABASE_DEVELOPMENT_SETUP.md** in order:

1. Create a NEW development Supabase project; disable public/email signup, configure SMTP, exact callbacks and TOTP.
2. Apply migrations 1–9 once (or only 7–9 if 1–6 are already recorded in that development project). Set its explicit development test markers.
3. Configure public keys and server secrets securely in ignored local files/environment settings; never in chat, source or a `VITE_` secret variable.
4. Invite/verify your administrator account, set a password, run the guarded UUID bootstrap, and enroll/verify MFA.
5. Create a separate Netlify development site and set its development-only Build/Functions variables. Leave the existing production site unchanged.
6. Configure the opt-in integration suite against that development project/site, including verified PostgreSQL TLS and owned test email addresses, then run it. It creates/cleans only its own synthetic UUID-scoped fixtures.
7. Apply the cloud network allowlist changes if this workspace should create the GitHub PR or inspect the supplied site's public endpoints. Supply the actual new development hostnames through environment settings when available.

## Remaining development and release gates

Actual new-user email verification, existing/unconfirmed-account retry behavior after a provider crash, callback/recovery expiry, real TOTP recovery, signed URL expiry and hosted tenant isolation must be tested with configured services. Test outcomes may expose provider-specific corrections; do not bypass MFA, RLS or signup restrictions to make them pass. Malware quarantine, orphaned file reconciliation, full audit revision detail, remaining product features, complete localization/accessibility, performance, backups/recovery and independent security review remain open. This branch is development integration work, not a production-readiness certification.

## Repository delivery status

The changes are committed locally on `dev/supabase-integration`. The branch could not be uploaded because the GitHub HTTPS tunnel returned an upstream 503, including on the approved external-network path. The GitHub PR API is also blocked: the final authorized `gh pr create` attempt returned HTTP 503 from the GraphQL endpoint. **No remote branch or pull request is claimed as created.** Main and production remain unchanged.

A verified Git bundle, one-commit patch, full source ZIP and prepared PR body are supplied as task artifacts. Restore the GitHub route and run `git push -u origin dev/supabase-integration`, then create the PR with the prepared body. No reset, force push or new token is justified by the observed transport failures.
