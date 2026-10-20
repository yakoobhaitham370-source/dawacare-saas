# Deployment checklist (not yet executed)

1. Complete OWNER_MANUAL.md against a separate Supabase development project. Keep public signup disabled; verify email, password recovery, invitation expiration, admin MFA and redirects.
2. Apply the inspected migration sequence and run hosted tenant-isolation, role, subscription, payment and private-document tests. Local PGlite tests are not a hosted deployment test.
3. Before production, configure tested backups for database and private objects, recovery procedures, monitoring, SMTP, rate limits and approved legal/consent/retention policies.
4. In Netlify, import this repository. Build command: `npm run build`; publish directory: `dist`; functions directory: `netlify/functions`. Use Node 24 LTS.
5. Configure frontend public variables and server-only secrets in Netlify's secure settings as described in `.env.example` and OWNER_MANUAL.md. `SITE_URL` must be the exact frontend origin. Never embed a service or AI key in a Vite variable.
6. The checked-in `netlify.toml` maps `/api/*` to functions, provides SPA fallback, and adds CSP, frame protection, MIME and referrer controls. Review CSP if using a custom Supabase domain. Netlify TLS configuration supplies HTTPS; do not assume a local server supplies production TLS.
7. Review the finished release and obtain deployment authorization before publishing. No deployment has been performed in this work segment.
8. After an authorized deploy, smoke-test login, MFA, invite acceptance, two-pharmacy separation, patient/medication/dispensing persistence, contact logging, private upload/download, payment confirmation and subscription expiry on desktop and 360px mobile.
9. Inspect the browser bundle for secrets and ensure no clinical source is sent to analytics. Enable error monitoring that excludes patient payloads and tokens.
10. Test cache updates and session expiry. PWA precache stores static assets only; authenticated API responses and patient records are not cached for offline use. Clinical offline mode is unsupported.
11. Never point automated tests at production data. Restore a backup into a separate project and complete a documented recovery drill before accepting patient records.

A domain, connected Netlify site, hosting configuration, Supabase project and any AI budget remain external prerequisites. Saving cloud environment instructions does not deploy this application or publish the cloud snapshot.
