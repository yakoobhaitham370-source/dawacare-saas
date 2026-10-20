# Security and release gates

The release is a development build. Do not use it for real patient care yet.

## Implemented boundaries

- Database-enforced tenant reads/writes with role-specific clinical finalization.
- Composite tenant/patient/medication/dispensing foreign keys; immutable tenant and creator context.
- Serialized patient and invitation seat limits, active subscription checks and bounded read retention.
- No browser service/AI keys; no public signup UI; Supabase signup must also be disabled externally.
- MFA-gated platform operations and no default clinical access for platform administrators.
- Append-only dispensing/contact/audit API grants, idempotent dispense requests and unique reminders.
- JWT/origin checks on privileged functions; validated file signatures and private short-lived document access.
- AI quota and rate reservation, schema validation, no automatic clinical persistence, explicit pharmacist review.
- CSV formula escaping, safe React text rendering, SPA security headers, no patient logs or service-worker clinical cache.

## Open release gates

1. Real Supabase Auth/PostgREST/Storage integration tests; email invitation acceptance and recovery; production admin MFA/recovery drill.
2. Independent security review of migrations, function authorization, clinical audit/corrections, storage upload cleanup and invitation crash/reconciliation behavior.
3. End-to-end cross-tenant read/write tests through the hosted REST and object APIs, malicious role payloads, signed-link expiry and revoked staff sessions.
4. Complete technician draft/approval queues and configurable fixed policy sets, clinical correction/revision UI, normalized condition UI, search pagination beyond 500 fetched rows and medicine search.
5. Full Arabic translation, keyboard/screen-reader/contrast audit, tablet/360px workflow coverage for every privileged workflow, production performance budget.
6. Verified live AI provider/model, patient consent, provider DPA, pricing estimates, external spending limits and operational dashboards.
7. Full billing lifecycle UI, hosted verification of invitation retry/revoke/recovery, read-only expiration banner, configurable retention, support access and operational job health.
8. Data export audit/rate controls, backup/restore drill, retention/deletion procedures, incident response and independent dependency/security review.
9. Production deployment, TLS, domain and service configuration, monitoring and acceptance tests with synthetic data.

The document file-signature check is not malware scanning. Consider an appropriate scanner and quarantine workflow before accepting untrusted production documents. Signed URLs are bearer access for their short lifetime; do not log or share them publicly.

## Local legal/privacy review

Obtain qualified advice on Iraqi healthcare confidentiality, patient consent, data-controller/processor duties, cross-border transfers, hosting location, breach response, access/correction requests and retention. A cloud subscription is not compliance evidence. No HIPAA, GDPR or Iraqi regulatory compliance certification is claimed.

Do not destructively reset production or disable RLS/TLS/checksum verification to work around failures. Keep secrets in provider settings. If exposed, rotate the key and assess affected access rather than merely deleting the visible copy.

## Integration branch security fixes

Explicit ACLs remove reliance on empty-schema default privileges. Browser calls cannot write memberships/invitations/events/audits, confirm payments, or register document metadata directly. Metadata registration is a service-only function that revalidates the verified user's tenant access. Delivery finish/recipient lookup RPCs are service-only; the caller JWT must first claim a lease with current role/MFA checks. Verified recipients explicitly accept only one pharmacy; expiry, revocation, inviter loss, subscription restrictions and seat reductions are rechecked.

Stale auth responses cannot restore another user's role/tenant; record caches are cleared on user changes. Recovery is separated from invitations. A verified bootstrap account can set a password without pharmacy membership; its admin privileges still require TOTP. No public privilege-escalation endpoint or MFA recovery bypass was added.

Frontend private-key rejection and development identity checks reduce accidental production connections in previews. These checks do not replace secure provider settings or independent review. Provider calls and full-stack integration remain unverified where credentials/access/resources are unavailable.
