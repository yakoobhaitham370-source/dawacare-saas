# DawaCare engineering rules

- Read docs/MASTER_SPECIFICATION.md and docs/ARCHITECTURE.md. Track honest progress in docs/implementation.json.
- Use the existing isolated checkout; do not create worktrees unless requested.
- Use React, strict TypeScript, Fluent UI v9, Supabase, and Netlify. Keep features modular.
- All tenant data requires database-enforced membership and role authorization. Never trust client tenant IDs. Use composite tenant foreign keys. Never expose service keys.
- No public signup. Only platform admins provision pharmacies; only owners invite staff. Require production admin MFA.
- Technicians may draft; only owners/pharmacists finalize clinical records. Do not permit role escalation.
- Dispensing history is append-only. Date-only supply is inclusive: 2026-10-20 + 30 days ends 2026-11-18. Default contact target is two days earlier. Never infer PRN supply. Explicit supply wins. Carry-over requires explicit review.
- Synthetic sandbox data must be visibly labeled, isolated from connected mode, and must never contain real patient data. No automatic production seed.
- AI output is untrusted and requires schema validation and pharmacist review. No browser AI secrets, automatic prescribing, or automatic persistence.
- Use private documents, tenant-scoped paths, validated uploads, and explicit authorization. No patient data in logs or analytics.
- Support English/Arabic, RTL/LTR, light/dark, keyboard access, and all business actions at 360px.
- Run relevant tests, TypeScript, lint, production build, and browser checks. Report exact executed/blocked checks; never infer readiness from a build alone.
- Do not reset production data, deploy, or run production migrations without explicit authorization. Never request privileged keys in chat. Document external dashboard steps.
- Preserve TLS, package integrity, existing files, and user changes. Record security and product limitations honestly.
