import { createClient } from "@supabase/supabase-js";
import { clinical, projection, shiftDate, today } from "./domain";
import type { Role, Row } from "./domain";
import { publicSupabaseConfig } from "./supabase-config";
let configuration: ReturnType<typeof publicSupabaseConfig> = null;
export let clientConfigurationError = "";
try {
  configuration = publicSupabaseConfig({
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
} catch {
  clientConfigurationError =
    "Invalid Supabase public configuration. Check the URL and public key; never use server secrets in VITE_ variables.";
}
export const supabase = configuration
  ? createClient(configuration.url, configuration.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "dawacare.connected.auth",
      },
    })
  : null;
export const SANDBOX_TENANT = "10000000-0000-4000-8000-000000000001";
const STORAGE = "dawacare.synthetic.v1";
type Store = Record<string, Row[]>;
const uid = () => crypto.randomUUID();
function seed(): Store {
  const pharmacy_id = SANDBOX_TENANT;
  const patients = [
    ["Ahmed Ali · أحمد علي", "+9647701234567", "Type 2 diabetes"],
    ["Noor Hassan · نور حسن", "+9647501234567", "Hypertension"],
    ["Omar Khalid · عمر خالد", "+9647801234567", "Type 2 diabetes"],
    ["Sara Mahmoud · سارة محمود", "+9647711234567", "Hypothyroidism"],
  ].map(([full_name, phone, conditions], i) => ({
    id: uid(),
    pharmacy_id,
    full_name,
    phone,
    conditions,
    city: "Mosul",
    display_number: i + 1,
    status: "active",
    communication_consent: false,
    created_at: new Date().toISOString(),
  }));
  const patient_medications = patients.map((p, i) => ({
    id: uid(),
    pharmacy_id,
    patient_id: p.id,
    medicine_name: ["Metformin", "Amlodipine", "Metformin", "Levothyroxine"][i],
    strength: ["500 mg", "5 mg", "850 mg", "50 mcg"][i],
    form: "Tablet",
    route: "Oral",
    instructions: "Synthetic example — confirm prescription",
    status: "active",
  }));
  const dispensing_events = patient_medications.map((m, i) => {
    const dispensed_on = shiftDate(today(), [-34, -28, -20, -5][i]);
    return {
      id: uid(),
      pharmacy_id,
      patient_id: m.patient_id,
      medication_id: m.id,
      dispensed_on,
      quantity: 30,
      days_supply: 30,
      lead_days: 2,
      carry_days: 0,
      ...projection({
        dispensed_on,
        quantity: 30,
        days_supply: 30,
        lead_days: 2,
        carry_days: 0,
        carry_reviewed: false,
      }),
      created_at: new Date().toISOString(),
    };
  });
  return {
    patients,
    patient_medications,
    dispensing_events,
    patient_contact_events: [],
    laboratory_results: [],
    patient_documents: [],
    clinical_audit_logs: [],
    pharmacies: [
      {
        id: pharmacy_id,
        name: "Al-Shifa Pharmacy · صيدلية الشفاء",
        city: "Mosul",
        owner_email: "owner@example.invalid",
        phone: "+9647700000000",
      },
    ],
    pharmacy_memberships: [
      {
        id: uid(),
        pharmacy_id,
        full_name: "Development pharmacist",
        role: "owner",
        active: true,
      },
    ],
    subscription_plans: [
      {
        id: uid(),
        name: "Professional",
        price: 75000,
        currency: "IQD",
        staff_limit: 5,
        patient_limit: 2000,
        ai_limit: 100,
        active: true,
      },
    ],
    subscriptions: [
      {
        id: uid(),
        pharmacy_id,
        status: "trial",
        starts_on: today(),
        ends_on: shiftDate(today(), 30),
        staff_limit: 5,
        patient_limit: 2000,
      },
    ],
    subscription_invoices: [],
    subscription_payments: [],
    administrative_audit_logs: [],
    platform_settings: [],
  };
}
function store(): Store {
  const raw = localStorage.getItem(STORAGE);
  if (raw) return JSON.parse(raw) as Store;
  const data = seed();
  localStorage.setItem(STORAGE, JSON.stringify(data));
  return data;
}
export function resetSandbox() {
  localStorage.removeItem(STORAGE);
}
export type Scope = { sandbox: boolean; tenant: string; role: Role };
const adminTables = [
  "pharmacies",
  "subscription_plans",
  "subscriptions",
  "subscription_invoices",
  "subscription_payments",
  "administrative_audit_logs",
  "platform_settings",
  "pharmacy_invitations",
];
function assertScope(table: string, scope: Scope, write: boolean) {
  if (scope.role === "super_admin" && !adminTables.includes(table))
    throw new Error("Platform administration does not grant clinical access.");
  if (write && adminTables.includes(table) && scope.role !== "super_admin")
    throw new Error(
      "Only the SaaS administrator can change billing or platform settings.",
    );
  if (
    write &&
    ["patient_medications", "laboratory_results"].includes(table) &&
    !clinical(scope.role)
  )
    throw new Error("Pharmacist verification is required.");
  if (write && table === "pharmacy_memberships" && scope.role !== "owner")
    throw new Error("Only the pharmacy owner can manage staff.");
  if (table.includes("audit") && write)
    throw new Error(
      "Audit history is append-only and generated automatically.",
    );
}
export async function list(table: string, scope: Scope): Promise<Row[]> {
  assertScope(table, scope, false);
  if (scope.sandbox) {
    const all = store()[table] ?? [];
    return scope.role === "super_admin"
      ? all
      : all.filter((r) => !r.pharmacy_id || r.pharmacy_id === scope.tenant);
  }
  if (!supabase) throw new Error("Configure Supabase to connect.");
  let query = supabase.from(table).select("*").limit(500);
  if (
    scope.role !== "super_admin" &&
    ![
      "pharmacies",
      "subscription_plans",
      "platform_settings",
      "administrative_audit_logs",
    ].includes(table)
  )
    query = query.eq("pharmacy_id", scope.tenant);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Row[];
}
export async function save(
  table: string,
  input: Record<string, unknown>,
  scope: Scope,
  id?: string,
): Promise<Row> {
  assertScope(table, scope, true);
  const body = {
    ...input,
    ...(!adminTables.includes(table) ? { pharmacy_id: scope.tenant } : {}),
  };
  if (scope.sandbox) {
    const data = store();
    const rows = data[table] ?? [];
    const previous = rows.find((r) => r.id === id);
    if (
      id &&
      (!previous ||
        (previous.pharmacy_id && previous.pharmacy_id !== scope.tenant))
    )
      throw new Error("Record unavailable.");
    const row: Row = {
      ...previous,
      ...body,
      id: id ?? uid(),
      created_at: previous?.created_at ?? new Date().toISOString(),
    };
    if (table === "patients" && !id)
      row.display_number = (data.patients?.length ?? 0) + 1;
    data[table] = id
      ? rows.map((r) => (r.id === id ? row : r))
      : [...rows, row];
    data.clinical_audit_logs.push({
      id: uid(),
      pharmacy_id: scope.tenant,
      action: `${id ? "update" : "create"}:${table}`,
      record_id: row.id,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE, JSON.stringify(data));
    return row;
  }
  if (!supabase) throw new Error("Configure Supabase to connect.");
  const q = id
    ? supabase.from(table).update(body).eq("id", id)
    : supabase.from(table).insert(body);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return data as Row;
}
export async function dispense(
  input: Record<string, unknown>,
  scope: Scope,
): Promise<void> {
  if (!clinical(scope.role))
    throw new Error("Only a pharmacist or owner can finalize dispensing.");
  if (!scope.sandbox) {
    if (!supabase) throw new Error("Configure Supabase.");
    const { error } = await supabase.rpc("record_dispensing", {
      p_pharmacy: scope.tenant,
      p_input: input,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const data = store();
  const medicine = data.patient_medications.find(
    (m) =>
      m.id === input.medication_id &&
      m.pharmacy_id === scope.tenant &&
      m.patient_id === input.patient_id,
  );
  if (!medicine || medicine.status !== "active")
    throw new Error("Select an active medication from this pharmacy.");
  if (
    input.request_id &&
    data.dispensing_events.some(
      (e) =>
        e.pharmacy_id === scope.tenant && e.request_id === input.request_id,
    )
  )
    return;
  const dates = projection(input as Parameters<typeof projection>[0]);
  const row: Row = {
    ...input,
    ...dates,
    id: uid(),
    pharmacy_id: scope.tenant,
    created_at: new Date().toISOString(),
  };
  data.dispensing_events.push(row);
  data.clinical_audit_logs.push({
    id: uid(),
    pharmacy_id: scope.tenant,
    action: "dispense",
    record_id: row.id,
    created_at: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE, JSON.stringify(data));
}
export function latestEvents(events: Row[]): Row[] {
  const latest = new Map<string, Row>();
  [...events]
    .sort(
      (a, b) =>
        String(a.dispensed_on).localeCompare(String(b.dispensed_on)) ||
        String(a.created_at).localeCompare(String(b.created_at)),
    )
    .forEach((e) => latest.set(String(e.medication_id), e));
  return [...latest.values()];
}
