# Test strategy and evidence

## Commands

- `npm run typecheck`: strict TypeScript across browser, functions, tests and tool configuration.
- `npm run lint`: TypeScript/React Hooks rules.
- `npm test`: domain rules, simulated AI contracts, privileged endpoint guards and PGlite database tests.
- `npm run test:db`: PostgreSQL policy/integrity subset.
- `npm run test:e2e`: Chromium desktop (1440px) and mobile (360px) browser workflows.
- `npm run build`: typed Vite production bundle and static PWA assets.
- `npm audit --omit=dev`: installed production dependency vulnerability metadata.

Playwright uses `/usr/bin/chromium` in this cloud image. The Playwright CDN download was denied by egress policy; the existing system browser was used successfully. No TLS or artifact verification was disabled. On a different machine provide `PLAYWRIGHT_CHROMIUM_PATH` or adapt the config to a properly installed browser.

## Coverage

Domain tests cover inclusive calendar dates, leap years, month/year boundaries, contact target, final covered day/overdue boundary, explicit supply precedence, fractional rounding, carry-over review, invalid dates, Arabic normalization, Iraqi phone formats, generic WhatsApp messages and CSV formula escaping.

PGlite runs an actual PostgreSQL engine with non-owner authenticated sessions. Tests cover cross-tenant reads/writes, composite foreign keys, tenant reassignment, actor spoofing, escalation, technician clinical restrictions, subscription expiry/limits, immutable dispensing/audits, projections/tasks, MFA administration, invitation reservations, transactional tenant creation, staff suspension, AI allowance/review gating, private object metadata policies and request idempotency. Supabase auth functions and storage tables are emulated. The real gateway/Auth/email/object services have not been tested.

Provider tests simulate responses and prove schema rejection/failure behavior. Endpoint guard tests check method/origin/configuration rejection and document signatures without service credentials. These tests do not prove successful provider calls or deployed functions.

Browser tests exercise patient registration and browser persistence, medicine entry, dispensing/history, refill/contact workflows, technician/admin navigation restrictions, Arabic RTL switching, dark mode, AI disabled state and public route guards. Tests run at desktop and 360px; complete Arabic content, tablet/accessibility and hosted administrator workflows remain unverified.

See `implementation.json` for the final run counts and remaining acceptance gates. Do not replace hosted testing with a successful build or synthetic local persistence. React Testing Library is installed for future targeted component tests; no separate RTL component suite is claimed in this segment.

## Supabase integration branch

`npm test` additionally exercises Supabase-style default privileges, invitation concurrency/expiry/recovery/explicit multi-tenant acceptance, service-only document registration, private frontend-key rejection, development target guards, stale auth result isolation, session expiry, sandbox isolation, and the bootstrap password screen. Provider email sends in unit tests are explicitly mocked.

`npm run test:integration` is an opt-in **real-service** suite. It fails with `BLOCKED` before test collection unless a synthetic development target and required secure settings are supplied. Remote runs require matching development project markers and verified database TLS. It creates and cleans only UUID-scoped test fixtures. Without a Netlify development URL it invokes Node function handlers against real Supabase; with that URL it tests deployed HTTP functions. Neither path targets the existing production website.

See INTEGRATION_REVIEW.md for the actual pass/blocked outcomes from this segment. Hosted tests are not silently skipped or relabeled as unit passes. The local Docker startup attempts failed during PostgreSQL image extraction under the 32 GB filesystem; no Supabase service integration pass is inferred from those attempts.
