# Pharmacy workspace manual

## Synthetic development walkthrough

1. Choose **Explore synthetic sandbox** on the home page. The amber banner must remain visible. Never enter real patient information here.
2. **Register patient** accepts Arabic/English names and Iraqi mobile numbers. Local `07…`, `+9647…`, and `009647…` formats normalize to `+9647…`. Potential phone/name matches warn but never merge automatically.
3. Open the patient profile and choose **medications**. Add a verified medicine, strength, form, route, directions and active status. A patient can have independent medicines and refill dates.
4. Choose **Dispense [medicine]**. Confirm actual date, quantity, days supply and reminder lead time. For PRN or irregular regimens, obtain confirmed days supply rather than assuming a daily formula.
5. Read the date preview before confirming. A 30-day supply on October 20 ends on November 18; November 19 is the first uncovered day. The default two-day contact target is November 16.
6. Leave carry-over at zero unless a pharmacist has explicitly reviewed remaining stock. If carrying days forward, enter them and check the review confirmation.
7. Confirm dispensing. **dispensing** shows the preserved history. A refill adds another event; it does not overwrite the old event.
8. Open **Refill queue**. Filter urgency, search patient/medicine, call or copy the phone number, and record a contact outcome. Recording contact does not mark a medicine refilled.
9. WhatsApp appears only where communication consent is recorded. It opens a manual chat with a generic message; it does not automatically send clinical details or use a WhatsApp Business API.
10. Add laboratory results from the patient **laboratory** section. Keep units/reference ranges explicit; the application does not diagnose. Trend charts and correction-version history remain pending.
11. **Reports** exports the authorized patient register or dispensing history. Sandbox exports contain synthetic examples. Treat connected exports as confidential and store them securely.
12. Use the header language and theme controls. The mobile menu provides the same navigation as desktop. Tables become labeled record cards on small screens, keeping every displayed field and action available.

## Connected workspace

Accept your invitation, set a strong password, then sign in. There is no public registration. Your owner manages team access; subscription changes belong to the SaaS administrator. Live invitations, storage and AI require the server configuration in OWNER_MANUAL.md and must be tested before patient use.

Technicians can enter basic patient details and contact outcomes but cannot approve clinical medications, dispensing or lab changes. Draft/approval queues are not complete yet. New patient forms currently support DOB; estimated-age UI, gender/prescriber fields, condition normalization, full medication regimen editing and several detailed patient sections remain roadmap items.

AI extraction is a reviewed transcription aid. Missing/ambiguous information must be confirmed manually. Do not dispense from an AI candidate. Documents are private with short-lived authorized downloads; synthetic mode deliberately disables transfer.

If an account is expired or suspended, database writes are denied. Authorized read/export remains available within the current retention window. Contact the SaaS administrator; records are never silently deleted by expiry.
