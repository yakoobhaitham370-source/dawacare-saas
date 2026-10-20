import { useAuth } from "../app/context";
import { useRows } from "../lib/hooks";
import { Collection } from "./Collection";
import { Download, Heading, Notice } from "../components/common";
import type { FieldDef } from "../components/common";
const field = (
  key: string,
  label: string,
  type: FieldDef["type"] = "text",
  required = false,
): FieldDef => ({ key, label, type, required });
const status = (key: string, options: string[]): FieldDef => ({
  key,
  label: key.replaceAll("_", " "),
  type: "select",
  required: true,
  options: options.map((value) => ({
    value,
    label: value.replaceAll("_", " "),
  })),
});
export const adminCollections: Record<
  string,
  {
    table: string;
    fields: FieldDef[];
    readonly?: boolean;
    description?: string;
  }
> = {
  pharmacies: {
    table: "pharmacies",
    fields: [
      field("name", "Pharmacy name", "text", true),
      field("city", "City", "text", true),
      field("phone", "Phone"),
      field("owner_email", "Owner email", "email"),
    ],
    readonly: true,
    description:
      "Tenant provisioning requires a verified server endpoint and invitation delivery. Directory is read-only until those gates pass.",
  },
  plans: {
    table: "subscription_plans",
    fields: [
      field("name", "Name", "text", true),
      field("price", "Price (IQD)", "number", true),
      field("currency", "Currency", "text", true),
      field("staff_limit", "Staff seats", "number", true),
      field("patient_limit", "Patient limit", "number", true),
      field("ai_limit", "Monthly AI requests", "number"),
      field("active", "Active", "boolean"),
    ],
  },
  subscriptions: {
    table: "subscriptions",
    fields: [
      field("pharmacy_id", "Pharmacy UUID", "text", true),
      field("plan_id", "Plan UUID", "text", true),
      status("status", [
        "trial",
        "active",
        "past_due",
        "grace_period",
        "suspended",
        "expired",
        "canceled",
      ]),
      field("starts_on", "Starts", "date", true),
      field("ends_on", "Ends", "date", true),
      field("staff_limit", "Staff seats", "number", true),
      field("patient_limit", "Patient limit", "number", true),
    ],
  },
  invoices: {
    table: "subscription_invoices",
    fields: [
      field("pharmacy_id", "Pharmacy UUID", "text", true),
      field("invoice_number", "Invoice number", "text", true),
      field("amount", "Amount", "number", true),
      field("currency", "Currency", "text", true),
      field("due_on", "Due date", "date", true),
      status("status", ["pending", "paid", "overdue", "void"]),
    ],
  },
  payments: {
    table: "subscription_payments",
    fields: [
      field("pharmacy_id", "Pharmacy UUID", "text", true),
      field("invoice_id", "Invoice UUID", "text", true),
      field("amount", "Amount", "number", true),
      field("currency", "Currency", "text", true),
      field("paid_on", "Payment date", "date", true),
      status("method", ["cash", "bank_transfer", "local_wallet", "other"]),
      field("reference", "Reference"),
      field("notes", "Notes", "textarea"),
    ],
    description:
      "Recording a payment does not confirm it. Use the separate audited confirmation action after verifying receipt.",
  },
  "audit-logs": {
    table: "administrative_audit_logs",
    fields: [
      field("created_at", "Time"),
      field("action", "Action"),
      field("actor_id", "Actor"),
      field("record_id", "Record"),
    ],
    readonly: true,
  },
  settings: {
    table: "platform_settings",
    fields: [
      field("key", "Setting", "text", true),
      field("value", "Value", "textarea", true),
    ],
  },
};
export function AdminOverview() {
  const pharmacies = useRows("pharmacies"),
    subs = useRows("subscriptions"),
    invoices = useRows("subscription_invoices");
  return (
    <>
      <Heading
        title="Platform control center"
        subtitle="Commercial and operational metadata. Clinical records remain private."
      />
      <div className="stats-grid">
        {[
          ["Pharmacies", pharmacies.data?.length ?? 0],
          [
            "Active subscriptions",
            subs.data?.filter((r) => r.status === "active").length ?? 0,
          ],
          [
            "Trial subscriptions",
            subs.data?.filter((r) => r.status === "trial").length ?? 0,
          ],
          [
            "Pending invoices",
            invoices.data?.filter((r) => r.status === "pending").length ?? 0,
          ],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <Notice>
        Revenue recognition, payment confirmation, usage aggregation and
        invitation provisioning require further server integration. Patient
        records are not exposed to platform administrators.
      </Notice>
    </>
  );
}
export function Subscription() {
  return (
    <Collection
      table="subscriptions"
      title="Your subscription"
      readonly
      fields={[
        field("status", "Status"),
        field("starts_on", "Starts"),
        field("ends_on", "Ends"),
        field("staff_limit", "Staff seats"),
        field("patient_limit", "Patient limit"),
      ]}
      description="Subscription changes and payment confirmation are managed by the SaaS owner."
    />
  );
}
export function Reports() {
  const patients = useRows("patients"),
    events = useRows("dispensing_events");
  return (
    <>
      <Heading
        title="Pharmacy reports"
        subtitle="Authorized exports contain sensitive data. Store and share them securely."
      />
      <div className="detail-grid">
        <section className="panel">
          <h2>Patient register</h2>
          <p>{patients.data?.length ?? 0} records in this pharmacy</p>
          <Download rows={patients.data ?? []} filename="dawacare-patients" />
        </section>
        <section className="panel">
          <h2>Dispensing history</h2>
          <p>{events.data?.length ?? 0} append-only events</p>
          <Download rows={events.data ?? []} filename="dawacare-dispensing" />
        </section>
      </div>
    </>
  );
}
export function Settings() {
  const { scope } = useAuth();
  return (
    <>
      <Heading title="Workspace settings" />
      <section className="panel">
        <h2>Pharmacy defaults</h2>
        <dl>
          <dt>Timezone</dt>
          <dd>Asia/Baghdad</dd>
          <dt>Currency</dt>
          <dd>IQD</dd>
          <dt>Default follow-up lead time</dt>
          <dd>
            2 calendar days before the last covered day; editable on each
            dispensing event.
          </dd>
          <dt>Mode</dt>
          <dd>
            {scope.sandbox ? "Synthetic local sandbox" : "Supabase-connected"}
          </dd>
        </dl>
        <Notice>
          Language and theme controls are in the workspace header. Pharmacy
          business settings require owner authorization and will be added with
          staff provisioning.
        </Notice>
      </section>
    </>
  );
}
