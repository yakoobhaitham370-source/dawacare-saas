# Architecture

DawaCare is an invitation-only multi-tenant pharmacy service for Iraq. The browser uses React, strict TypeScript, Fluent UI v9, React Router, TanStack Query, React Hook Form/Zod, and i18next. Currency defaults to IQD; business dates use Asia/Baghdad.

## Trust boundaries

The live adapter calls Supabase with the public client key and the authenticated user's JWT. PostgreSQL RLS is authoritative. Memberships are stored server-side, not in editable profile metadata. Tenant-owned relationships include pharmacy_id in composite foreign keys. Platform administration has metadata access only; it does not confer clinical access. A pharmacy owner/pharmacist may finalize dispensing; a technician may prepare drafts. No frontend role selector exists in live mode.

Netlify Functions verify JWTs via Supabase, then delegate privileged operations to constrained database functions. A service key is confined to the server. Invitations reserve seats and require transactional database changes plus an outbox-style retry state for external email delivery. Public signup must be disabled in Supabase.

## Development sandbox

The explicit /sandbox entry opens an isolated synthetic-data adapter using browser storage under a dedicated versioned key. It is a workflow test aid, not authentication, production persistence, or a secure medical record system. The real application uses /login and never falls back to sandbox on connection failure. Real patient data must never be entered in sandbox. Seed dates use the current Baghdad calendar so queues remain useful. Sandbox role switching is a labeled testing tool only.

## Clinical model

Patients, longitudinal medicines, dispensing events, projections and contact events are separate entities. Dispensing records are immutable; corrections reference earlier events and include a reason. Supply calculations use date-only strings with calendar arithmetic. A 30-day supply beginning October 20 ends November 18 inclusively. Contact date is last-covered date minus lead days. Remaining covered days includes today; overdue starts on the first uncovered day. Refill urgency and contact outcome are independent. A pharmacist explicitly chooses carry-over. PRN/custom schedules require confirmed days supply.

## Delivery and limitations

Migrations are version-controlled; the browser contains no administrative key. PWA caching excludes authenticated API traffic and patient records. No offline clinical cache is promised. Netlify provides SPA fallback and HTTP security headers. See PRODUCT_ROADMAP.md and implementation.json for verified scope. Publication and production deployment are separate manual operations.

## Decisions

1. Single Supabase project, database-enforced isolation, with normalized tables rather than arbitrary JSON records.
2. Explicit local sandbox lets development continue without credentials while keeping integration claims honest.
3. Date-only arithmetic and explicit pharmacist review take priority over inferred precision.
4. Initial payments are manually recorded and separately confirmed; payment method never implies verification.
5. Commercial super-admin privileges do not bypass clinical RLS.
