# DAWACARE — MASTER DEVELOPMENT SPECIFICATION

## ROLE AND MISSION

You are my autonomous senior software engineering team, consisting of:

- Principal full-stack software architect
- Senior React and TypeScript developer
- Fluent UI design system specialist
- Supabase PostgreSQL database engineer
- Authentication and cybersecurity engineer
- Multi-tenant SaaS architect
- AI integration engineer
- Pharmacist-oriented healthcare workflow designer
- Quality assurance and automated testing engineer
- DevOps and Netlify deployment engineer

Your responsibility is to design, implement, test, document, and prepare an exceptionally polished, commercially viable SaaS application called **DawaCare**.

Do not produce merely a dashboard mockup, a proof of concept, or a static demonstration.

Build a genuine application with working navigation, functional forms, persistent data, authorization, real business workflows, testing, deployment configuration, and an extensible architecture.

**I am a community pharmacy owner and pharmacist in Mosul, Iraq. I intend to use this application in my pharmacy and sell subscriptions to other Iraqi community pharmacies.**

I am not an experienced programmer. Make the development process friendly to a nontechnical founder. Explain exactly what you need from me when an external service must be configured.

You must actively write and modify project files, install dependencies when permitted, run builds, execute tests, fix errors, and provide working code.

Do not stop after creating a project skeleton.

---

# PART 1 — PRODUCT VISION

## 1.1 Product identity

Application name: DawaCare

Product category: Multi-tenant pharmacy SaaS

Initial target market: Community pharmacies in Iraq

Initial languages: English and Arabic

Initial currency: Iraqi dinar (IQD)

Initial timezone: Asia/Baghdad

Primary workflows:

1. Register patients with chronic diseases.
2. Record medication dispensing and supply durations.
3. Track when patients are expected to exhaust their medicines.
4. Identify patients requiring refill contact.
5. Maintain accurate dispensing and refill histories.
6. Use AI to reduce manual patient and medication data entry.
7. Allow pharmacy teams to collaborate securely.
8. Let the SaaS owner sell and administer pharmacy subscriptions.

Design for expansion to additional countries, currencies, subscription models, and languages.

## 1.2 Essential product principles

1. Mobile-first design, with complete desktop feature parity.
2. Strong privacy, confidentiality, and role-based access control.
3. Reliable medication calculations and transparent rules.
4. Efficient workflows suitable for a busy pharmacy counter.
5. Excellent Arabic RTL and English LTR support.
6. Clean and modern Microsoft Fluent UI design.
7. Subscription management controlled by the SaaS owner.
8. Modular architecture that supports future features.
9. Real persistent data, not hardcoded dashboard statistics.
10. Secure AI assistance with mandatory pharmacist review.

Keep the UI understandable for pharmacists who are unfamiliar with complex business software.

---

# PART 2 — REQUIRED TECHNOLOGY STACK

Use the following technology unless a documented technical incompatibility requires a change.

## 2.1 Frontend

- React
- TypeScript with strict type checking
- Vite
- Fluent UI React v9 (`@fluentui/react-components`)
- Fluent UI icons
- React Router
- TanStack Query
- React Hook Form
- Zod schema validation
- date-fns or an equivalent reliable date library
- Recharts for analytics where suitable
- i18next or equivalent internationalization framework
- Vite-compatible Progressive Web App support

Prefer Fluent UI components over generic browser styling.

Use Fluent design tokens, spacing, typography, focus states, accessible dialogs, and consistent visual hierarchy.

Avoid mixing multiple unrelated UI frameworks.

## 2.2 Backend and data

- Supabase PostgreSQL
- Supabase Authentication
- Supabase Storage
- PostgreSQL Row Level Security
- PostgreSQL constraints and indexes
- Version-controlled SQL migrations
- Secure server-side functions for privileged operations

## 2.3 Hosting

- Netlify for frontend hosting
- Netlify Functions for privileged backend operations, including AI requests and administrative account provisioning where appropriate
- Netlify environment variables
- GitHub-compatible deployment workflow

## 2.4 Testing

- Vitest
- React Testing Library
- Playwright
- Database policy and integration tests
- TypeScript verification
- ESLint
- Automated production build checks

## 2.5 AI architecture

Create a provider-independent AI service adapter.

The selected provider and model must be configurable through secure server-side environment variables.

AI model calls must never be made with exposed secret keys in frontend code.

Provide:

- Text extraction
- Image and prescription interpretation
- Structured JSON output
- Schema validation
- Confidence and ambiguity warnings
- Human review before persistence

Use a production-supported multimodal provider with structured-output support, chosen during implementation based on current documentation.

Do not assume an AI provider is free or unlimited. Provide estimated usage-cost controls, disabled states, and a non-AI manual entry alternative.

---

# PART 3 — MULTI-TENANT SAAS ARCHITECTURE

## 3.1 Tenancy model

Use one centrally managed Supabase project containing multiple logically isolated pharmacy tenants.

Each pharmacy has a unique immutable UUID.

All pharmacy-specific records must be linked to the appropriate tenant.

Example:

DawaCare SaaS
- Pharmacy A
  - Pharmacy owner
  - Pharmacists
  - Pharmacy technicians
  - Patients
  - Medicines
  - Refill history
- Pharmacy B
  - Pharmacy owner
  - Pharmacists
  - Pharmacy technicians
  - Patients
  - Medicines
  - Refill history

Pharmacy A must never be able to read or alter Pharmacy B's information.

Do not create a separate Supabase account or database project for each pharmacy by default.

Use one controlled multi-tenant architecture with strong database-enforced isolation.

## 3.2 Tenant security

Requirements:

- Tenant isolation enforced at the PostgreSQL level using Row Level Security.
- Never trust a tenant ID supplied by the browser without validating the signed-in user's membership.
- Prevent unauthorized tenant switching.
- Never depend solely on hiding UI components for authorization.
- Apply the principle of least privilege.
- Server-side administrative access must be explicitly scoped and audited.
- Use tenant-scoped storage paths and secure storage access policies.
- Test malicious cross-tenant read/write attempts.
- Do not expose Supabase secret or administrative keys to the client.

Every tenant-owned database table must have appropriate authorization and auditing.

If a user belongs to more than one pharmacy, permit only explicitly authorized membership switching.

---

# PART 4 — USER ROLES AND PERMISSIONS

Implement a role-based authorization system with five main roles.

## 4.1 SaaS Super Admin — ME

This is the highest-privilege platform administrator.

Only I can provision a new pharmacy tenant or initial pharmacy-owner account.

Capabilities:

- Access the private SaaS owner dashboard.
- Create new pharmacy organizations.
- Invite their initial pharmacy owners.
- View and edit pharmacy business information.
- Set and change subscription plans.
- Set subscription start and end dates.
- Activate, pause, suspend, and reactivate subscriptions.
- Manage subscription payments.
- View platform-wide commercial analytics.
- View aggregate tenant usage information.
- Change pharmacy account limits.
- Review provisioning and administrative audit logs.
- Revoke pharmacy access.
- Manage the application feature configuration.
- View service health and operational diagnostics.
- Manage subscription pricing.
- Approve or reject subscription extensions.
- Reset onboarding invitations when appropriate.
- Configure platform support contact details.

Important privacy requirement:

The super-admin dashboard should show pharmacy account metadata, billing, usage counts, and operational indicators by default, **not unrestricted patient medical records**.

Any exceptional clinical-data support access must require explicit authorization, justification, time limitation, and audit logging.

## 4.2 Pharmacy Owner

The initial pharmacy owner is invited exclusively by the SaaS super admin.

Capabilities:

- Access their pharmacy dashboard.
- Update authorized pharmacy business information.
- Invite and manage pharmacists and technicians.
- Create, edit, view, archive, and search patients.
- Manage chronic medication records.
- Record medication dispensing.
- Track refill dates.
- Manage patient follow-up workflows.
- Use permitted AI extraction tools.
- View pharmacy reports.
- View subscription status and restrictions.
- Review staff activity and audit logs.
- Change permitted pharmacy settings.

Cannot:

- Create other pharmacy organizations.
- Change subscription limits.
- Edit subscription plans or payment confirmation.
- View another pharmacy's records.
- Access SaaS super-admin settings.
- Grant permissions greater than their own.

## 4.3 Pharmacist

Capabilities:

- Register and manage patients.
- Add, verify, and update chronic medications.
- Record dispensing events.
- Correct medication supply information.
- Review AI-extracted data.
- Enter and review laboratory results.
- Manage refill follow-ups.
- Export authorized patient and refill reports.
- Access their pharmacy's allowed operational analytics.

Cannot:

- Create pharmacy tenants.
- Change subscriptions.
- Change SaaS system settings.
- Grant themselves increased permissions.
- Access other pharmacies.

## 4.4 Pharmacy Technician

Capabilities:

- Search and view permitted patient records.
- Add patient details when authorized.
- Prepare medication-entry drafts.
- Record or draft refill contact outcomes.
- Create pending dispensing records.
- Upload documents for pharmacist review.
- Use permitted non-finalizing workflows.

Clinical verification, medication-order approval, and final pharmacist-only actions must require pharmacist or pharmacy-owner authorization.

Make technician permissions configurable through carefully defined policies, never through unrestricted arbitrary permission granting.

## 4.5 Platform Service Role

Used solely for backend system operations.

It must not be available as an interactive pharmacy user role.

---

# PART 5 — AUTHENTICATION AND ACCOUNT CREATION

## 5.1 No public registration

The application must not have a public registration form.

The public website may have:

- Home page
- Features
- Pricing information
- Contact sales
- Login

However, visitors must not be able to register themselves as pharmacy organizations.

## 5.2 Pharmacy onboarding

Required workflow:

1. I sign into the SaaS super-admin dashboard.
2. I select "Create Pharmacy."
3. I enter the pharmacy's business details.
4. I choose a subscription plan.
5. I set account limits and activation dates.
6. I enter the pharmacy owner's email.
7. The backend validates my super-admin authorization.
8. The system creates a new tenant.
9. The system creates an invitation for the pharmacy owner.
10. The owner securely activates their account.
11. The owner signs into their pharmacy workspace.
12. The owner can invite pharmacists and technicians according to their plan limits.

All related database changes must be transactional or have safe compensating behavior if an invitation or external email operation fails.

## 5.3 Pharmacy staff onboarding

Required workflow:

1. Pharmacy owner opens Staff Management.
2. Owner selects Add Staff.
3. Owner enters name, email, and role.
4. Backend validates owner permission.
5. Backend checks active subscription and user limits.
6. Staff member receives an invitation.
7. Staff member securely activates their login.
8. Their membership is linked to the correct pharmacy.
9. Role-specific access becomes available.

Invitation tokens must expire and must not be reused.

## 5.4 Authentication features

Implement:

- Secure login
- Password reset
- Email verification where appropriate
- Session expiration
- Session recovery
- Secure logout
- Invitation acceptance
- Account deactivation
- Password strength validation
- Rate-limiting and abuse prevention
- Optional MFA, with super-admin MFA required for production
- Audit records for sensitive account events

Disable self-service signup in Supabase configuration as appropriate, and enforce all provisioning rules server-side.

A hidden registration page is not sufficient security.

---

# PART 6 — SAAS SUPER-ADMIN DASHBOARD

This is my private commercial control center.

Use a premium enterprise-style Fluent UI dashboard.

## 6.1 Dashboard overview

Show:

- Total registered pharmacies
- Active pharmacy subscriptions
- Trial subscriptions
- Expiring subscriptions
- Expired subscriptions
- Suspended pharmacies
- Monthly recurring revenue
- Annual recurring revenue
- Subscription collections
- Overdue or pending payments
- Active pharmacy users
- Platform usage metrics
- New pharmacies this month
- Subscription renewals due soon

Use database-derived values rather than static examples.

## 6.2 Pharmacy Management

Table columns:

- Pharmacy ID
- Pharmacy name
- Owner name
- Owner email
- Phone
- City
- Province
- Subscription plan
- Subscription status
- Start date
- End date
- Staff limit
- Patient limit
- Number of active staff
- Registered patient count
- Last activity
- Actions

Actions:

- Create pharmacy
- Edit business details
- Open pharmacy details
- Manage owner invitation
- Suspend/reactivate access
- Change subscription
- Extend expiration date
- View billing records
- Review administrative logs

Support searching, filtering, sorting, and pagination.

## 6.3 Subscription Management

The super admin can:

- Create plans
- Edit plan prices
- Set patient limits
- Set staff limits
- Configure AI usage allowances
- Configure included features
- Activate plans
- Retire plans
- Set monthly, quarterly, or annual billing
- Set trial duration
- Apply manual discounts
- Record billing exceptions
- Extend subscriptions
- Suspend overdue accounts

Initial subscription plans:

- Trial
- Basic
- Professional
- Enterprise

The plan names and prices must be editable, not hardcoded.

## 6.4 Subscription lifecycle

Support subscription states including:

- Trial
- Active
- Past due
- Grace period
- Suspended
- Expired
- Canceled

Use explicit transition rules.

Account expiration must not silently delete patient records.

A suspended pharmacy should receive a clear explanation of its status and allowed actions.

Consider read-only record access and authorized export during an appropriate retention period.

Define the exact suspension and retention policy in application configuration.

## 6.5 Payments

For the initial Iraqi market, implement manual payment administration.

Payment options may include:

- Cash
- Bank transfer
- Local wallet or payment transfer
- Other manually recorded method

Do not automatically claim that payments have been verified.

Required fields:

- Invoice number
- Pharmacy
- Amount
- Currency
- Due date
- Payment date
- Payment method
- Reference
- Payment status
- Notes
- Confirmed by
- Confirmation timestamp

Only authorized SaaS administrators can confirm payments.

Design a payment-provider interface for future automated billing integration.

Use IQD as the default but keep the model multicurrency-ready.

## 6.6 Platform operational tools

Include:

- Global plan configuration
- Account provisioning events
- AI usage totals
- Failed background tasks
- Refill-processing health
- Storage usage
- Database operation errors
- Contact/support requests
- Audit event viewer

Do not expose administrative database secrets in the UI.

---

# PART 7 — PHARMACY DASHBOARD

Each pharmacy gets its own workspace, visually distinct from the SaaS owner dashboard.

## 7.1 Main pharmacy dashboard

Show:

- Total patients
- Active chronic patients
- Patients requiring attention today
- Overdue refills
- Refills due tomorrow
- Refills due within 2 days
- Refills due within 7 days
- Patients contacted today
- Completed dispensing events
- Unresolved follow-ups
- Recently added patients
- Recent activity

## 7.2 Visual analytics

Charts may include:

- Upcoming refill counts
- Overdue patient trends
- Completed dispensing events over time
- Follow-up completion rates
- Chronic patient population by condition
- Staff workload

All metrics must be derived from real authorized database queries.

## 7.3 Prioritized patient lists

Include dedicated lists:

- Overdue
- Due today
- Due tomorrow
- Due in 2 days
- Due within 7 days
- Refill completed
- Follow-up required
- Unreachable
- Temporarily paused

Use clear and consistent status indicators.

Avoid confusing "due for refill" with "definitely out of medication."

---

# PART 8 — PATIENT MANAGEMENT

## 8.1 Patient registration

Required fields:

- Auto-generated patient UUID
- Pharmacy-scoped display patient number
- Full name
- Date of birth or estimated age
- Age estimation reference date when DOB is unknown
- Gender, optional
- Primary phone number
- WhatsApp phone number, optional
- Address, optional
- City
- Chronic diseases or conditions
- Prescribing doctor
- Patient notes
- Registration date
- Active/inactive status
- Created by
- Last updated by

Support Iraqi phone number formats, including +964 and local notation.

Allow names in Arabic and English.

Avoid mandatory fields that are unnecessary for basic registration.

## 8.2 Patient profile

Create a rich patient-detail interface with these sections:

1. Overview
2. Active medications
3. Dispensing history
4. Refill schedule
5. Follow-up history
6. Chronic conditions
7. Laboratory results
8. Uploaded documents
9. Activity history
10. Notes

Support adding, editing, and archiving records through appropriate permissions.

## 8.3 Patient search

Search by:

- Name
- Patient display number
- Phone number
- Chronic condition
- Medication
- Refill status

Support Arabic names and normalization of common Arabic variants where reasonable.

Include paging and efficient indexing.

## 8.4 Duplicate detection

When adding a patient, check for potential duplicates based on:

- Phone number
- Normalized name
- DOB or estimated age, where available

Show potential matches without automatically merging patients.

Merging must require explicit authorized action and preserve audit information.

---

# PART 9 — MEDICATION MANAGEMENT

A patient may have many chronic medications.

Each medication must be independently tracked.

## 9.1 Medication fields

Required:

- Unique medication record ID
- Patient ID
- Pharmacy ID
- Medicine name
- Brand or generic name where known
- Strength
- Pharmaceutical form
- Route
- Dosing instructions
- Units per dose
- Frequency
- Quantity dispensed
- Days supply
- Dispensing date
- Expected supply-end date
- Next refill target date
- Prescribing doctor
- Medication status
- Notes
- Created by
- Last updated by

Optional:

- Pack information
- Price in IQD
- Batch identifier
- Prescription reference
- Patient-reported adherence
- Refill reminder lead time

## 9.2 Frequency options

Support:

- Once daily
- Twice daily
- Three times daily
- Four times daily
- Up to twelve times daily
- Every other day
- Weekly schedules
- Custom schedules
- As-needed medication

Never use a simple daily-quantity formula for PRN or irregular schedules without sufficient information.

Allow manual days-supply entry.

## 9.3 Medication entry

The user must be able to:

- Add one medication
- Add multiple medications together
- Edit existing medications
- Discontinue medications
- Reactivate medication records when appropriate
- Change strengths
- Update dose and frequency
- Record dispensing
- Review dispensing history
- Correct previous records with an audit trail
- View calculated supply information

Do not overwrite historical dispensing records every time a patient obtains medicine.

Separate longitudinal medication treatment records from dispensing events.

---

# PART 10 — REFILL TRACKING ENGINE

This is the most important clinical workflow.

## 10.1 Fundamental logic

Each dispensing event may include:

- Dispensing date
- Quantity
- Dose regimen
- Explicit days supply
- Calculation method
- Expected exhaustion date
- Follow-up target
- Reminder lead time

When explicit days supply is provided, use it as the authoritative duration for that dispensing event unless corrected by an authorized user.

Use an explicit inclusive-date convention:

If a medicine is first taken on October 20 and has a 30-day supply, its expected last covered day is November 18.

Keep this convention consistent across database storage, display, alerts, and tests.

Represent dates using date-only values where appropriate to avoid timezone rollover errors.

For example:

Dispensed: 2026-10-20

Days supply: 30

Expected last covered date: 2026-11-18

The next uncovered day is 2026-11-19.

Default follow-up lead time: 2 calendar days before the expected last covered date.

Make this setting configurable.

## 10.2 Days remaining

Calculate days remaining from the expected last covered date using the pharmacy-local calendar date.

Clearly distinguish:

- Remaining covered days
- Last covered date
- Next uncovered day
- Recommended contact date

Never allow a hidden off-by-one-day inconsistency.

## 10.3 Automated calculation

For a simple fixed-dose medication:

Days supply = quantity dispensed / units consumed per day.

However:

- If the result is fractional, expose the rounding policy.
- If dosing is variable, require manual review.
- If frequency is irregular, do not fabricate accuracy.
- If adherence is unknown, label estimates accordingly.

Prefer pharmacist-confirmed supply duration.

## 10.4 Refill status

Statuses:

- On track
- Due soon
- Due today
- Overdue
- Follow-up pending
- Contacted
- Refilled
- Paused
- Discontinued

Do not conflate follow-up status with medication status.

## 10.5 Recording a refill

When a patient refills medication:

1. Open the patient record.
2. Select the relevant medication.
3. Click Record Refill.
4. Enter the actual dispensing date.
5. Confirm quantity and days supply.
6. Review calculated dates.
7. Save a new dispensing event.
8. Update the active refill projection.
9. Preserve previous dispensing history.
10. Update dashboard and follow-up queues.

Correctly handle early refills.

Do not automatically assume early supplies are consumed sequentially or stockpiled. Offer an explicit pharmacist decision about carrying forward remaining supply.

## 10.6 Reminder engine

Implement a deterministic reminder scheduler.

Store scheduled follow-up tasks with:

- Pharmacy ID
- Patient ID
- Medication ID
- Dispensing event ID
- Scheduled date
- Reminder type
- Status
- Assigned staff member
- Contact outcome
- Completion timestamp

Make task creation idempotent.

Avoid duplicate reminders after repeated synchronization or retry operations.

Use Asia/Baghdad as the default business timezone.

## 10.7 Manual contact actions

Provide:

- Call patient
- Copy phone number
- Open WhatsApp chat
- Mark contacted
- No answer
- Patient will return
- Refill completed
- Patient declined
- Reschedule follow-up

For WhatsApp, construct a properly encoded wa.me link and require the pharmacist to initiate the message manually.

Do not implement automatic WhatsApp sending or assume a free WhatsApp Business messaging API exists.

Obtain appropriate consent for medication-related communications.

Keep clinical details out of default WhatsApp text whenever possible.

## 10.8 Follow-up center

Create a daily work queue with:

- Patient
- Phone
- Medication
- Refill date
- Days remaining
- Assigned staff
- Priority
- Last contact attempt
- Next action

Support filtering, bulk assignment, and individual completion.

Avoid bulk messaging without explicit authorization.

---

# PART 11 — AI PATIENT AND PRESCRIPTION EXTRACTION

Develop a practical AI-assisted entry system.

This feature must significantly reduce manual typing.

## 11.1 Supported input methods

Allow:

1. Typing natural-language patient information.
2. Pasting text.
3. Uploading prescription images.
4. Taking a photograph on a mobile phone.
5. Uploading a document or PDF when supported.

## 11.2 Example free-text input

"My patient Ahmed Ali, age 62, phone 07701234567. Takes metformin 500 mg twice daily for 30 days and amlodipine 5 mg once daily for 60 days."

AI should propose a structured result containing:

Patient:

- Name: Ahmed Ali
- Age: 62
- Phone: 07701234567

Medications:

1. Metformin, 500 mg, twice daily, 30 days supply
2. Amlodipine, 5 mg, once daily, 60 days supply

The extracted data must populate a review form.

Do not directly save AI output.

## 11.3 Extraction fields

Patient:

- Name
- Age
- Date of birth, if explicitly present
- Phone
- Address
- Chronic conditions
- Prescribing doctor

For each drug:

- Original text
- Candidate drug name
- Strength
- Dosage form
- Dose
- Frequency
- Quantity, if known
- Days supply, if stated
- Duration
- Prescriber
- Notes
- Field-level uncertainty flags

Support Arabic and English.

## 11.4 AI extraction requirements

The system must:

- Distinguish missing data from inferred data.
- Never invent names, phone numbers, strengths, or supply durations.
- Preserve the original text where feasible.
- Detect multiple medications.
- Support partially readable prescriptions.
- Flag illegible handwriting.
- Mark ambiguous dose directions.
- Require human confirmation for clinical fields.
- Validate the returned JSON schema.
- Reject malformed AI responses safely.
- Allow editing every field before saving.
- Keep an extraction audit record without retaining unnecessary sensitive source material.
- Detect attempts to inject instructions through the uploaded text or image and treat all extracted text as untrusted input.

## 11.5 AI review interface

Create a split review screen:

Left:
- Original prescription image or submitted text

Right:
- Structured patient details
- Medication cards
- Field warnings
- Editable dose and supply information
- Confirmation checkboxes where required

Actions:

- Retry extraction
- Edit extracted values
- Add missing medication
- Delete incorrect candidate
- Match existing patient
- Save verified data
- Cancel

Require appropriate pharmacist verification before finalizing medication dispensing records.

## 11.6 AI cost controls

Include:

- Per-pharmacy monthly AI allowance
- AI requests used
- Estimated usage cost
- Server-side rate limiting
- File size limits
- Image format validation
- Timeout and retry handling
- Safe errors
- Manual entry fallback

Never include external AI secrets in browser bundles, logs, or Git commits.

## 11.7 Healthcare AI safety

This AI feature is an information-extraction assistant, not a prescribing or medical decision-making system.

It must not independently:

- Diagnose patients
- Change drug doses
- Recommend unrequested treatment changes
- Approve illegible prescriptions
- Authorize dispensing
- Substitute inferred medicine names without review

Include appropriate verification messaging.

---

# PART 12 — LABORATORY RESULTS

Allow each patient to have longitudinal laboratory records.

Fields:

- Result ID
- Pharmacy ID
- Patient ID
- Test name
- Numeric or qualitative result
- Unit
- Reference range
- Collection date
- Entered date
- Notes
- Source document
- Created by

Examples:

- HbA1c
- Fasting glucose
- Creatinine
- eGFR
- Lipid profile
- Blood pressure readings, in a separately appropriate measurement category

Features:

- Add
- Edit with audit history
- View history
- Display trends
- Filter by date
- Upload supporting documents
- Export authorized records

Support configurable units and avoid combining incompatible measurements on a single trend chart.

Do not automatically generate clinical diagnoses from laboratory data.

---

# PART 13 — DOCUMENT STORAGE

Use private Supabase Storage buckets.

Supported document categories:

- Prescriptions
- Laboratory reports
- Other relevant patient documents

Requirements:

- Upload
- View
- Secure download
- Delete or archive according to policy
- File size restrictions
- MIME type validation
- Access authorization
- Tenant separation
- Private signed access URLs
- Audit events

Do not use public storage buckets for patient medical records.

Avoid placing patient names or other identifying details in public-facing storage paths.

---

# PART 14 — PHARMACY STAFF MANAGEMENT

Pharmacy owner must have a complete Staff Management page.

Features:

- View staff
- Invite staff
- Assign role
- View invitation status
- Resend invitation
- Change authorized role
- Suspend staff access
- Revoke membership
- Review activity
- Display seat usage

Plan limits must be enforced server-side.

Example:

If a pharmacy has five licensed user seats, its owner must not be able to create a sixth active membership without an authorized plan change.

An invited but not yet activated user must be handled according to an explicit seat-reservation rule.

A user may have separate memberships in more than one pharmacy only when independently authorized.

---

# PART 15 — COMPLETE MOBILE FEATURE PARITY

This requirement is NON-NEGOTIABLE.

Many pharmacists in Iraq use mobile phones as their main computing device.

Therefore, the mobile application must provide 100% of the business functionality of desktop and tablet.

Do not eliminate, permanently hide, or disable features just because the viewport is small.

## 15.1 Responsive breakpoints

Design for:

- Compact phones
- Large phones
- Tablets
- Laptops
- Large desktops

Test representative widths:

- 320px
- 360px
- 390px
- 430px
- 768px
- 1024px
- 1440px

## 15.2 Mobile navigation

Use appropriate responsive patterns such as:

- Collapsible navigation drawer
- Compact app header
- Contextual action menu
- Optional bottom navigation for frequently used destinations
- Responsive cards
- Full-screen form dialogs
- Responsive record-detail layouts

## 15.3 Mobile patient workflows

A mobile-only pharmacy owner must be able to:

- Add patients
- Edit patient profiles
- Search records
- Enter medication details
- Use AI extraction
- Photograph prescriptions
- Upload lab reports
- Record refills
- Manage reminders
- Assign staff
- Manage staff invitations
- View reports
- Export authorized data
- View subscription status
- Change permitted settings

The SaaS super-admin dashboard must also work on a phone.

## 15.4 Tables on mobile

Never solve responsive design by cutting off important table columns or actions.

Instead use:

- Card representations
- Detail drawers
- Expandable rows
- Responsive data grids
- Contextual menus

All original record fields and actions must remain accessible.

## 15.5 PWA

Add:

- Installable app manifest
- App icons
- Responsive launch experience
- Appropriate caching
- Offline shell/error handling
- Online/offline indicators

Do not cache sensitive patient records in unsecured persistent storage.

Offline editing and synchronization are outside the initial release unless a secure and fully tested implementation is explicitly approved.

---

# PART 16 — USER INTERFACE AND VISUAL DESIGN

## 16.1 Visual target

Design DawaCare as a polished, modern healthcare SaaS.

Visual references:

- Microsoft Fluent 2 design language
- Professional enterprise administration interfaces
- Contemporary healthcare management applications

Avoid:

- Primitive HTML forms
- Outdated dashboard templates
- Excessive gradients
- Unnecessary animations
- Cluttered cards
- Tiny mobile controls
- Inconsistent typography
- Overcrowded navigation

## 16.2 Theme

Use Fluent UI React v9.

Include:

- Light theme
- Dark theme
- Consistent primary accent
- Neutral surfaces
- Accessible status indicators
- Clear input borders
- Consistent border radii
- Responsive spacing

Suggested brand direction:

DawaCare should feel trustworthy, clean, contemporary, calm, and highly usable.

## 16.3 Core components

Create reusable:

- AppShell
- DashboardLayout
- ResponsiveNavigation
- PageHeader
- MetricCard
- DataTable
- SearchToolbar
- PatientCard
- MedicationCard
- RefillStatus
- StatusBadge
- ConfirmationDialog
- FormDrawer
- EmptyState
- LoadingSkeleton
- ErrorState
- PermissionGate
- SubscriptionBanner
- ActivityTimeline
- AIReviewPanel

Use properly implemented accessible Fluent UI equivalents.

## 16.4 Interaction quality

Include:

- Loading indicators
- Save feedback
- Form validation
- Undo where safely possible
- Confirmation for destructive actions
- Unsaved-changes warning
- Clear empty states
- Helpful error messages
- Keyboard navigation
- Correct focus behavior
- Accessible labels
- Adequate touch target sizing

---

# PART 17 — ARABIC AND ENGLISH

Support:

- English LTR
- Arabic RTL
- Language switching
- Persistent language preferences
- Arabic-friendly typography
- Correct layout mirroring
- Phone numbers remaining readable
- Medication strengths remaining readable
- Proper number formatting
- Iraqi dinar currency formatting
- Asia/Baghdad date handling

Arabic translations must be natural for pharmacists in Iraq.

Do not reverse medication names, units, or telephone strings incorrectly in RTL layouts.

Allow users to enter patient records in either Arabic or English regardless of UI language.

---

# PART 18 — DATABASE DESIGN

Implement version-controlled SQL migrations.

At minimum create the following entities, with appropriate additional tables, constraints, and relationships.

## 18.1 Platform and identity

- profiles
- pharmacies
- pharmacy_memberships
- pharmacy_invitations
- subscription_plans
- subscriptions
- subscription_invoices
- subscription_payments
- feature_entitlements
- platform_settings
- administrative_audit_logs

## 18.2 Clinical and operational

- patients
- patient_conditions
- medication_catalog
- patient_medications
- medication_regimens
- dispensing_events
- refill_projections
- refill_tasks
- patient_contact_events
- laboratory_results
- patient_documents
- clinical_audit_logs

## 18.3 AI and operational infrastructure

- ai_extraction_jobs
- ai_usage_records
- notification_preferences
- scheduled_job_runs
- application_events

## 18.4 General database requirements

Use:

- UUID primary keys
- Explicit foreign keys
- Appropriate unique constraints
- Created-at timestamps
- Updated-at timestamps
- Created-by identifiers
- Soft archival where appropriate
- Immutable history where legally or operationally needed
- Proper database indexes
- Strict enum or validated status values
- Separate date-only and timestamp fields as appropriate

All tenant-owned records must carry tenant context that can be validated through database policy.

Avoid putting unrelated functionality in oversized JSON columns.

Use normalized relational design.

## 18.5 Critical integrity requirements

- No orphan dispensing events.
- No patient linked to another pharmacy's medication.
- No unauthorized membership assignment.
- No role escalation through edited API payloads.
- No tenant identifier reassignment by a pharmacy user.
- No duplicate processing of the same refill event.
- No silent deletion of audit history.
- No unrestricted access to patient documents.
- No unauthorized access to subscription editing.
- No frontend-only enforcement of plan limits.

Write SQL constraints and security policies for these cases.

---

# PART 19 — SECURITY AND PRIVACY

This application handles patient-related health information and must be designed accordingly.

Requirements:

1. Use HTTPS in production.
2. Implement Row Level Security on all exposed tenant tables.
3. Enforce server-side role checks.
4. Protect administrative keys.
5. Validate inputs with schemas.
6. Rate-limit sensitive endpoints.
7. Restrict allowed upload types.
8. Use secure storage policies.
9. Do not expose patient details in analytics logs.
10. Implement meaningful audit logs.
11. Ensure secure session handling.
12. Avoid leaking private information through error responses.
13. Protect against injection and cross-site scripting.
14. Apply appropriate content security controls.
15. Use dependency security scanning.
16. Configure backups and test recovery procedures.
17. Define data retention and deletion policies.
18. Implement authorized data export.
19. Require access verification before returning clinical records.
20. Minimize external AI transmission of identifiable patient information.

Do not assume that hosting medical information on a cloud provider automatically satisfies Iraqi privacy or healthcare data requirements.

Document legal, consent, data processing, cross-border hosting, retention, and data residency questions requiring qualified local review before commercial production launch.

Do not claim HIPAA, GDPR, or Iraqi regulatory compliance without appropriate independent assessment.

---

# PART 20 — APPLICATION ROUTES

Create logical application routes.

## 20.1 Public

- /
- /features
- /pricing
- /contact
- /login
- /forgot-password
- /accept-invitation

## 20.2 SaaS owner

- /admin/dashboard
- /admin/pharmacies
- /admin/pharmacies/:id
- /admin/subscriptions
- /admin/plans
- /admin/invoices
- /admin/payments
- /admin/analytics
- /admin/audit-logs
- /admin/settings

## 20.3 Pharmacy

- /app/dashboard
- /app/patients
- /app/patients/new
- /app/patients/:id
- /app/patients/:id/edit
- /app/medications
- /app/refills
- /app/follow-ups
- /app/ai-entry
- /app/laboratory
- /app/documents
- /app/staff
- /app/reports
- /app/subscription
- /app/settings

Implement route-level authorization and appropriate loading/error states.

---

# PART 21 — PROJECT FOLDER STRUCTURE

Organize the codebase approximately as follows:

dawacare/
- public/
- src/
  - app/
  - components/
    - layout/
    - common/
    - patients/
    - medications/
    - refills/
    - ai/
    - admin/
  - features/
    - authentication/
    - saas-admin/
    - subscriptions/
    - pharmacies/
    - patients/
    - medications/
    - dispensing/
    - refill-tracking/
    - follow-ups/
    - ai-extraction/
    - laboratory/
    - documents/
    - reports/
    - staff/
  - hooks/
  - lib/
    - supabase/
    - api/
    - auth/
    - validation/
    - dates/
    - permissions/
  - services/
  - types/
  - locales/
    - en/
    - ar/
  - styles/
  - test/
- netlify/
  - functions/
- supabase/
  - migrations/
  - tests/
  - seed.sql
- tests/
  - e2e/
- docs/
  - ARCHITECTURE.md
  - DATABASE.md
  - SECURITY.md
  - PERMISSIONS.md
  - AI_INTEGRATION.md
  - DEPLOYMENT.md
  - TESTING.md
  - PRODUCT_ROADMAP.md
  - OWNER_MANUAL.md
  - PHARMACY_MANUAL.md
- .env.example
- .gitignore
- netlify.toml
- package.json
- README.md
- AGENTS.md

You may refine this structure to avoid unnecessary complexity, but maintain clear modular boundaries.

---

# PART 22 — DEVELOPMENT PHASES

Work incrementally and verify each phase.

Do not substitute visual completion for functional completion.

## PHASE 0 — Project analysis and planning

Tasks:

1. Inspect the existing repository.
2. Identify existing files, components, and dependencies.
3. Create an implementation plan.
4. Document architectural decisions.
5. Identify missing external credentials.
6. Create a development checklist.
7. Establish project conventions.
8. Establish a test strategy.
9. Create AGENTS.md with project-specific instructions.

Deliverables:

- Architecture document
- Implementation checklist
- Repository structure
- External dependency checklist
- Initial risk register

Do not discard functioning code without a good reason.

If the repository is empty, scaffold a new project.

## PHASE 1 — Design system and application foundation

Build:

- React application
- TypeScript configuration
- Fluent UI provider
- Light/dark themes
- English/Arabic infrastructure
- App shell
- Responsive navigation
- Routing
- Error boundaries
- Reusable form components
- Loading and empty states
- Mobile navigation patterns

Verify UI at required viewport widths.

## PHASE 2 — Database and authentication

Build:

- SQL schema
- Database migrations
- RLS policies
- Authentication integration
- Session management
- Invitation-based onboarding
- User profile management
- Role and permission checks
- Tenant membership handling
- Privileged provisioning endpoints

Test cross-tenant isolation before developing business features.

If Supabase credentials are unavailable, prepare migrations and local integration instructions without pretending a real database is connected.

## PHASE 3 — SaaS owner control center

Implement:

- Super-admin authentication
- Dashboard analytics
- Pharmacy provisioning
- Pharmacy directory
- Tenant management
- Subscription plans
- Subscription assignment
- Subscription renewal
- Manual invoice/payment management
- Suspension/reactivation
- Administrative audit records

Verify real CRUD operations.

## PHASE 4 — Pharmacy and staff management

Implement:

- Pharmacy dashboard
- Pharmacy profile
- Owner account
- Staff invitations
- Role assignment
- Staff suspension
- Staff seat limits
- Subscription entitlements

Test role escalation prevention.

## PHASE 5 — Patient management

Implement:

- Patient listing
- Registration
- Editing
- Detailed profile
- Searching
- Duplicate warnings
- Conditions
- Notes
- Archival
- Audit history

Verify persistence and tenant separation.

## PHASE 6 — Medications and dispensing

Implement:

- Multiple medications per patient
- Medication editing
- Dose information
- Regimen changes
- Dispensing events
- Refill recording
- Historical dispensing records
- Medication discontinuation

Test clinical-data integrity.

## PHASE 7 — Refill engine

Implement:

- Deterministic refill calculations
- Calendar-based expiration
- Days-remaining calculations
- Due and overdue queues
- Follow-up tasks
- Background processing
- Idempotency
- Early refill handling
- Contact outcomes

Test dates extensively.

## PHASE 8 — AI-assisted entry

Implement:

- Text extraction
- Image input
- Structured output
- Validation
- Editable review interface
- Patient matching
- Multiple medication extraction
- Manual confirmation
- AI usage quotas
- Error handling
- Secure API calls

Test malformed and ambiguous AI results.

## PHASE 9 — Laboratory and document management

Implement:

- Laboratory data entry
- Trend charts
- Secure document upload
- Document preview
- Private access
- Authorization policies

## PHASE 10 — Reports and subscription enforcement

Implement:

- Pharmacy reports
- Refill completion metrics
- Staff activity
- CSV export
- Subscription limits
- Subscription expiration behavior
- SaaS commercial analytics

## PHASE 11 — Localization and responsive completion

Audit every page.

Verify:

- English
- Arabic
- RTL
- Dark mode
- Light mode
- Desktop
- Tablet
- Mobile
- Keyboard accessibility
- Screen-reader behavior
- All actions available on mobile

## PHASE 12 — Security, performance and testing

Run:

- TypeScript type checking
- ESLint
- Unit tests
- Integration tests
- SQL/RLS tests
- End-to-end tests
- Tenant-isolation tests
- Role authorization tests
- Mobile interaction tests
- AI validation tests
- Date calculation tests
- Production build

Fix failed tests.

Do not mark tests as passed unless they were executed successfully.

## PHASE 13 — Deployment readiness

Prepare:

- Supabase migration instructions
- Environment variable documentation
- Netlify build configuration
- Netlify Functions deployment
- SPA route fallback
- Production environment checks
- Authentication redirect settings
- Domain configuration
- Backup/recovery instructions
- Security checklist
- Deployment smoke tests

Deploy only when the necessary accounts and credentials are provided and deployment is authorized.

---

# PART 23 — TESTING ACCEPTANCE CRITERIA

The following scenarios must be demonstrated with automated tests where practical.

## Scenario A — Tenant isolation

Create Pharmacy A and Pharmacy B.

Register patients in both.

Log in as Pharmacy A staff.

Attempt to retrieve Pharmacy B's patients through the API and database client.

Expected: Unauthorized access denied.

Repeat for medications, documents, payments, and membership operations.

## Scenario B — Owner provisioning

Sign in as SaaS super admin.

Create Pharmacy C.

Invite an owner.

Accept invitation.

Log in as owner.

Expected: Pharmacy C workspace works and only its authorized records are visible.

## Scenario C — Staff management

Log in as Pharmacy C owner.

Invite pharmacist.

Invite technician.

Expected: Correct roles and permissions after invitation acceptance.

Technician must not finalize pharmacist-only actions.

## Scenario D — Refill calculation

Create a dispensing event dated 2026-10-20 with 30 days supply.

Expected last covered date: 2026-11-18.

Verify reminder calculation using a two-day lead time.

Check late-month and leap-year cases.

## Scenario E — Multiple medications

Create patient with three active medicines.

Give each a different supply duration.

Expected: Each medication has its own refill projection.

## Scenario F — Refill history

Record a second dispensing event.

Expected: Original event remains in history and active projection updates correctly.

## Scenario G — AI extraction

Submit bilingual patient information with two medicines.

Expected: Structured review form is populated, but no patient or medication is saved until authorized confirmation.

## Scenario H — Subscription expiration

Expire a pharmacy subscription.

Expected: Policy-defined restrictions are enforced server-side without deleting patient data.

## Scenario I — Mobile-only operation

At 360px width, test all primary patient, refill, staff, AI, and subscription workflows.

Expected: No essential action is inaccessible.

## Scenario J — Security

Attempt to:

- Create a pharmacy from a non-admin account
- Edit another tenant's patient
- Upgrade one's own role
- Exceed subscription limits
- Access private document URLs without authorization
- Call an administrative function without valid authorization

Expected: Requests are rejected with secure responses and appropriate logs.

---

# PART 24 — PRODUCTION READINESS AND QUALITY GATES

Before calling the application production-ready, confirm:

- No unresolved critical security vulnerabilities
- No exposed secrets
- No placeholder authorization
- No mock persistence disguised as real database access
- No broken navigation
- No unimplemented primary workflows
- No tenant leakage
- No incorrect refill-date logic
- No unauthorized account registration
- No failed critical tests
- No broken Arabic RTL layouts
- No inaccessible mobile functionality
- No unrestricted AI endpoint
- No public patient document access

Document any remaining risks explicitly.

A successful frontend build alone does not establish production readiness.

---

# PART 25 — DOCUMENTATION FOR THE OWNER

I am not an advanced programmer.

Produce step-by-step documentation explaining:

1. How to install and run the project.
2. How to create a Supabase project.
3. How to obtain permitted client credentials.
4. How to configure backend secrets.
5. How to apply database migrations.
6. How to bootstrap the first SaaS super admin securely.
7. How to create my first pharmacy.
8. How to invite a pharmacy owner.
9. How the pharmacy owner adds staff.
10. How to configure the AI provider.
11. How to deploy to Netlify.
12. How to update the application safely.
13. How to make database backups.
14. How to restore from backups.
15. How to review logs.
16. How to manage subscriptions.
17. How to investigate common errors.
18. How to test changes before publishing.

Use numbered instructions and indicate exactly which actions must be performed manually in external dashboards.

Never request that I paste privileged secret keys into chat, source files, screenshots, or Git commits.

Use secure environment variable and local secret-management workflows.

---

# PART 26 — CODEX AUTONOMOUS WORKING INSTRUCTIONS

These instructions govern your work.

## Rule 1 — Actually implement

Do not merely explain how to develop DawaCare.

Create and modify real files.

Run the available development commands.

## Rule 2 — Incremental verified delivery

After every phase:

- Summarize the files changed.
- State which features now work.
- Report tests executed.
- Report failed or skipped tests.
- Explain blockers.
- Update the implementation checklist.
- Proceed to the next logical phase when possible.

Do not repeatedly request permission for ordinary implementation decisions.

## Rule 3 — No fabricated completion

Never claim a database integration is complete without a connection or meaningful integration tests.

Never claim AI extraction works without a functioning provider integration or clearly labeled simulated tests.

Never claim deployment succeeded without verifiable deployment evidence.

## Rule 4 — No fake buttons

Every button and menu item must lead to a working action, a functional page, or a clearly explained unavailable state.

Do not build an interface full of decorative buttons that do nothing.

## Rule 5 — Avoid outdated design

Do not use a primitive CRUD administration template as the final UI.

Implement the contemporary Fluent design system with polished and consistent workflows.

## Rule 6 — Never sacrifice mobile features

Any change to desktop functionality must be reflected on mobile.

Maintain identical business capabilities across form factors.

## Rule 7 — Preserve data safety

Do not destructively reset production data.

Do not execute dangerous production migrations without an explicit safety procedure and approval.

## Rule 8 — Use authentic documentation

Consult current official documentation for relevant libraries and service APIs whenever browsing or documentation access is available.

Do not invent API methods.

## Rule 9 — Manage complexity

Use maintainable modules, type-safe interfaces, reusable logic, and meaningful tests.

Avoid oversized components, deeply nested conditional logic, duplicated authorization rules, and unnecessary dependencies.

## Rule 10 — Record architectural decisions

Document important choices and their rationale.

## Rule 11 — Continue substantive development

Do not stop simply because the layout looks complete.

Advance through the development checklist as far as the environment and available credentials allow.

## Rule 12 — Explain real external blockers

If an external credential, account, payment, or deployment authorization is required:

- Complete all remaining work that does not require it.
- Provide a precise setup checklist.
- Mark the dependent integration as pending.
- Do not fabricate successful connectivity.
- Continue with independent phases where possible.

---

# PART 27 — FIRST EXECUTION INSTRUCTIONS

Start now.

Perform these actions in order:

1. Inspect the current repository and environment.
2. Determine whether the repository is empty or contains reusable code.
3. Create `AGENTS.md` containing the enduring engineering and security rules.
4. Create `docs/ARCHITECTURE.md`.
5. Create `docs/PRODUCT_ROADMAP.md`.
6. Create a machine-readable implementation checklist.
7. Scaffold the React, TypeScript, Vite, and Fluent UI application.
8. Create the core visual design system.
9. Implement application routing and responsive layouts.
10. Begin building functional authentication and tenant architecture.
11. Continue through the development phases with verification.

Use realistic but clearly marked development seed data where credentials are not yet available.

Keep development demo data isolated from real production records.

Do not require Supabase or Netlify accounts merely to create and test the application architecture locally.

At the end of each execution segment, report:

- Completed work
- Files created or modified
- Tests passed
- Tests not executed
- Known issues
- Current development phase
- Next engineering tasks
- Any manual action required from me

**Ultimate goal: Deliver a commercially viable DawaCare SaaS application that I can administer as its owner and license to independent community pharmacies, with reliable chronic medication refill tracking, AI-assisted patient registration, strong tenant isolation, complete mobile functionality, and production deployment support.**

Begin implementing the project immediately.