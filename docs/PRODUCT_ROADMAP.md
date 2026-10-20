# Delivery plan

The authoritative requirements are in MASTER_SPECIFICATION.md. Check implementation.json for current evidence and gaps.

0. Architecture, conventions, external dependency register.
1. Fluent UI shell, bilingual infrastructure, responsive routing, light/dark.
2. Supabase schema/RLS, login/reset, memberships and server authorization. Verify cross-tenant boundaries.
   3–4. Platform administration, subscription lifecycle, pharmacy and staff invitations.
   5–7. Patient records, independent medicines, append-only dispensing and refill/contact workflows.
3. Server-only AI extraction, structured review, quotas and provider verification.
   9–10. Laboratory records, private documents, reports, subscription restrictions.
   11–13. Complete localization/accessibility audit, full integration/E2E security gates, controlled production deployment.

## Initial risks and external dependencies

- Supabase project URL and publishable/anon key are missing: live authentication, hosted RLS, storage and email cannot be verified yet.
- Netlify site/account and deployment authorization are missing: production is not deployed.
- AI provider credentials, pricing approval, and consent/data-processing arrangements are missing: external extraction remains unavailable until configured.
- No real patient information should be used before privacy, consent, hosting location, cross-border processing and retention policies receive qualified Iraqi legal review.
- Production admin MFA, email delivery, backups and recovery require dashboard configuration and real-environment validation.
- A synthetic workspace does not prove hosted integration or regulatory compliance.

Continue independent implementation and test locally. Never mark incomplete gates as passed.
