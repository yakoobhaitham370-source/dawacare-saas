# AI integration

`src/services/extraction.ts` defines a provider-independent adapter and a strict bilingual extraction schema. The current adapter supports OpenAI's multimodal chat-completion API with strict JSON-schema output, a configurable model, a 30-second timeout and output-token cap. Missing fields are nullable, every medication carries confidence and warnings, and source content is explicitly untrusted.

`netlify/functions/extract.ts` validates authentication, origin, consent, tenant membership, pharmacist role and subscription allowance before sending anything. The database serializes monthly allowance/rate reservations. Failures consume allowance. Source text/images are not stored in DawaCare tables or generic logs. Provider retention and processing are subject to the provider's contract and need review.

The UI displays editable candidates, original source and uncertainty. Matching an existing patient requires explicit selection. Verified saving is atomic and does not create dispensing events. Supply and dispensing require a separate pharmacist-confirmed action. The AI cannot prescribe, diagnose, change treatment, or finalize a dispensing event.

Text and JPEG/PNG images are supported in the implementation. PDFs, true field-level uncertainty, automatic patient-match suggestions, retries, detailed price estimates, and a full AI usage dashboard are pending. Usage token counts are recorded; estimated cost is intentionally null until verified model pricing is configured. Bound spending with provider-level budgets in addition to the hard application request allowance.

The provider API shape was cross-checked against official OpenAI SDK documentation via its GitHub repository; live model behavior remains unverified. Unit tests use explicitly simulated provider responses. No successful external extraction is claimed.

Server-only variables: `AI_PROVIDER=openai`, `AI_MODEL`, `AI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SITE_URL`. Never prefix secrets with `VITE_`. See OWNER_MANUAL.md for secure setup.
