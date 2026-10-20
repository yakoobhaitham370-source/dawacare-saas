import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { TOTP, Secret } from "otpauth";
import { integrationTarget } from "./target";
import invite from "../../netlify/functions/invite";
import documents from "../../netlify/functions/documents";
import { today, shiftDate } from "../../src/lib/domain";
const config = integrationTarget(process.env),
  sql = new Client({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
    application_name: "dawacare-development-integration",
  });
const client = () =>
  createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const service = createClient(config.url, config.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = crypto.randomUUID(),
  password = `DawaCare-Test-${crypto.randomUUID()}!`;
const users: { id: string; email: string; client: SupabaseClient }[] = [],
  tenants: string[] = [],
  paths: string[] = [];
let admin: SupabaseClient,
  ownerA: SupabaseClient,
  ownerB: SupabaseClient,
  technician: SupabaseClient,
  pharmacist: SupabaseClient,
  plan: string,
  patientA: string,
  patientB: string,
  medicineA: string,
  medicineB: string,
  ownerInvite: string;
async function ok<R extends { data: unknown; error: unknown }>(
  result: R,
  label: string,
): Promise<NonNullable<R["data"]>> {
  if (result.error || result.data === null || result.data === undefined)
    throw new Error(
      `${label} failed (details suppressed to avoid leaking credentials or clinical payloads).`,
    );
  return result.data as NonNullable<R["data"]>;
}

async function makeUser(role: string) {
  const email = `dawacare-${role}-${run}@${config.emailDomain}`;
  const user = await ok(
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    }),
    `Create synthetic ${role}`,
  );
  if (!user.user) throw new Error("Synthetic user was not created");
  const c = client();
  users.push({ id: user.user.id, email, client: c });
  await ok(
    await c.auth.signInWithPassword({ email, password }),
    `Sign in ${role}`,
  );
  return c;
}
async function token(c: SupabaseClient) {
  const session = await ok(
    await c.auth.getSession(),
    "Read authenticated session",
  );
  if (!session.session) throw new Error("Authenticated session missing");
  return session.session.access_token;
}
async function call(
  name: "invite" | "documents",
  c: SupabaseClient,
  body: string | FormData,
) {
  const origin = config.netlifyUrl ?? "http://localhost:8888";
  const headers: Record<string, string> = {
    Origin: origin,
    Authorization: `Bearer ${await token(c)}`,
  };
  if (typeof body === "string") headers["Content-Type"] = "application/json";
  const req = new Request(`${origin}/api/${name}`, {
    method: "POST",
    headers,
    body,
  });
  return config.netlifyUrl
    ? fetch(req)
    : name === "invite"
      ? invite(req)
      : documents(req);
}
async function createTenant(name: string, email: string) {
  const result = (await ok(
    await admin.rpc("provision_pharmacy", {
      p_input: {
        name: `Synthetic integration ${name} ${run}`,
        city: "Mosul",
        owner_email: email,
        plan_id: plan,
        starts_on: today(),
        ends_on: shiftDate(today(), 30),
      },
    }),
    "Provision tenant",
  )) as { pharmacy_id: string; invitation_id: string };
  tenants.push(result.pharmacy_id);
  return result;
}
beforeAll(async () => {
  await sql.connect();
  if (!config.local) {
    const markers = await sql.query(
      "select key,value from public.platform_settings where key in ('environment','integration_project_ref')",
    );
    const m = new Map(markers.rows.map((r) => [r.key, r.value]));
    if (
      m.get("environment") !== "development" ||
      m.get("integration_project_ref") !== config.projectRef
    )
      throw new Error(
        "BLOCKED: development project markers do not match; no test writes performed.",
      );
  }
  process.env.DAWACARE_ENVIRONMENT = "development";
  process.env.DAWACARE_DEVELOPMENT_PROJECT_REF = config.projectRef ?? "";
  process.env.SUPABASE_URL = config.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = config.serviceKey;
  process.env.SITE_URL = config.netlifyUrl ?? "http://localhost:8888";
  admin = await makeUser("admin");
  ownerA = await makeUser("owner-a");
  ownerB = await makeUser("owner-b");
  technician = await makeUser("technician");
  pharmacist = await makeUser("pharmacist");
  await sql.query("insert into public.platform_admins(user_id) values($1)", [
    users[0].id,
  ]);
}, 60000);
afterAll(async () => {
  // Delete only this run's UUID-scoped synthetic fixtures, never reset a database.
  if (paths.length)
    await service.storage.from("patient-documents").remove(paths);
  if (tenants.length)
    for (const table of [
      "ai_usage_records",
      "ai_extraction_jobs",
      "patient_documents",
      "laboratory_results",
      "patient_contact_events",
      "refill_tasks",
      "refill_projections",
      "dispensing_events",
      "medication_regimens",
      "patient_medications",
      "patient_conditions",
      "patients",
      "medication_catalog",
      "notification_preferences",
      "pharmacy_invitations",
      "pharmacy_memberships",
      "feature_entitlements",
      "subscription_payments",
      "subscription_invoices",
      "subscriptions",
      "application_events",
      "clinical_audit_logs",
    ])
      await sql.query(
        `delete from public.${table} where pharmacy_id=any($1::uuid[])`,
        [tenants],
      );
  if (tenants.length)
    await sql.query("delete from public.pharmacies where id=any($1::uuid[])", [
      tenants,
    ]);
  if (plan)
    await sql.query("delete from public.subscription_plans where id=$1", [
      plan,
    ]);
  if (users.length) {
    const ids = users.map((u) => u.id);
    await sql.query(
      "delete from public.administrative_audit_logs where actor_id=any($1::uuid[])",
      [ids],
    );
    await sql.query(
      "delete from public.platform_admins where user_id=any($1::uuid[])",
      [ids],
    );
    await sql.query("delete from public.profiles where id=any($1::uuid[])", [
      ids,
    ]);
    for (const u of users) await service.auth.admin.deleteUser(u.id);
  }
  await sql.end();
}, 60000);
describe(
  config.local
    ? "real local Supabase Auth / PostgREST / Storage integration"
    : "hosted development Supabase integration",
  () => {
    it("verifies Auth registration is disabled through the actual service", async () => {
      const settings = await fetch(`${config.url}/auth/v1/settings`, {
        headers: { apikey: config.key },
      });
      expect(settings.status).toBe(200);
      expect((await settings.json()).disable_signup).toBe(true);
      const attempted = await client().auth.signUp({
        email: `dawacare-blocked-${run}@${config.emailDomain}`,
        password,
      });
      if (attempted.data.user)
        users.push({
          id: attempted.data.user.id,
          email: attempted.data.user.email!,
          client: client(),
        });
      expect(!!attempted.error).toBe(true);
    });
    it("requires real TOTP MFA before platform provisioning", async () => {
      expect(
        !!(await ownerA.rpc("provision_pharmacy", { p_input: {} })).error,
      ).toBe(true);
      expect(
        !!(await admin.rpc("provision_pharmacy", { p_input: {} })).error,
      ).toBe(true);
      const factor = await ok(
        await admin.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Synthetic development integration",
        }),
        "Enroll TOTP",
      );
      if (factor.type !== "totp") throw new Error("TOTP factor unavailable");
      const otp = new TOTP({
        secret: Secret.fromBase32(factor.totp.secret),
      }).generate();
      await ok(
        await admin.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: otp,
        }),
        "Verify TOTP",
      );
      expect(
        (await admin.auth.mfa.getAuthenticatorAssuranceLevel()).data
          ?.currentLevel,
      ).toBe("aal2");
    });
    it("creates pharmacies transactionally and delivers/retries invitations to existing accounts", async () => {
      const p = await ok(
        await admin
          .from("subscription_plans")
          .insert({
            name: `Development ${run}`,
            price: 0,
            currency: "IQD",
            staff_limit: 3,
            patient_limit: 10,
            ai_limit: 0,
            active: true,
          })
          .select("id")
          .single(),
        "Create development plan",
      );
      plan = p.id;
      const a = await createTenant("A", users[1].email);
      const b = await createTenant("B", users[2].email);
      ownerInvite = a.invitation_id;
      const delivered = await call(
        "invite",
        admin,
        JSON.stringify({ invitation_id: ownerInvite }),
      );
      expect(delivered.status).toBe(200);
      await ok(
        await ownerA.rpc("accept_pharmacy_invitation", { p_id: ownerInvite }),
        "Accept owner A",
      );
      await ok(
        await ownerB.rpc("accept_pharmacy_invitation", {
          p_id: b.invitation_id,
        }),
        "Accept owner B",
      );
      expect(
        (
          await ownerA
            .from("pharmacy_memberships")
            .select("role")
            .eq("user_id", users[1].id)
        ).data?.[0]?.role,
      ).toBe("owner");
    });
    it("invites pharmacists and technicians, reserves seats and rejects overflow", async () => {
      const tech = await ok(
        await ownerA.rpc("prepare_invitation", {
          p_pharmacy: tenants[0],
          p_email: users[3].email,
          p_role: "technician",
        }),
        "Reserve technician",
      );
      const pharm = await ok(
        await ownerA.rpc("prepare_invitation", {
          p_pharmacy: tenants[0],
          p_email: users[4].email,
          p_role: "pharmacist",
        }),
        "Reserve pharmacist",
      );
      expect(
        !!(
          await ownerA.rpc("prepare_invitation", {
            p_pharmacy: tenants[0],
            p_email: `extra-${run}@${config.emailDomain}`,
            p_role: "technician",
          })
        ).error,
      ).toBe(true);
      await ok(
        await technician.rpc("accept_pharmacy_invitation", { p_id: tech }),
        "Accept technician",
      );
      await ok(
        await pharmacist.rpc("accept_pharmacy_invitation", { p_id: pharm }),
        "Accept pharmacist",
      );
      expect(
        !!(
          await technician.rpc("prepare_invitation", {
            p_pharmacy: tenants[0],
            p_email: `attack-${run}@${config.emailDomain}`,
            p_role: "owner",
          })
        ).error,
      ).toBe(true);
    });
    it("persists patients and medications across fresh REST requests with tenant isolation", async () => {
      const a = await ok(
        await ownerA
          .from("patients")
          .insert({
            pharmacy_id: tenants[0],
            full_name: `Synthetic patient A ${run}`,
            phone: "+9647701234567",
          })
          .select("id")
          .single(),
        "Save patient A",
      );
      const b = await ok(
        await ownerB
          .from("patients")
          .insert({
            pharmacy_id: tenants[1],
            full_name: `Synthetic patient B ${run}`,
            phone: "+9647501234567",
          })
          .select("id")
          .single(),
        "Save patient B",
      );
      patientA = a.id;
      patientB = b.id;
      const medication = (pharmacy_id: string, patient_id: string) => ({
        pharmacy_id,
        patient_id,
        medicine_name: "Synthetic metformin",
        strength: "500 mg",
        form: "Tablet",
        route: "Oral",
        instructions: "Synthetic fixture only",
        status: "active",
      });
      medicineA = (
        await ok(
          await ownerA
            .from("patient_medications")
            .insert(medication(tenants[0], patientA))
            .select("id")
            .single(),
          "Save medicine A",
        )
      ).id;
      medicineB = (
        await ok(
          await ownerB
            .from("patient_medications")
            .insert(medication(tenants[1], patientB))
            .select("id")
            .single(),
          "Save medicine B",
        )
      ).id;
      expect(
        (await ownerA.from("patients").select("id").eq("id", patientB)).data,
      ).toEqual([]);
      expect(
        (
          await ownerA
            .from("patients")
            .update({ city: "Unauthorized" })
            .eq("id", patientB)
            .select("id")
        ).data,
      ).toEqual([]);
      expect(
        !!(
          await ownerA.from("patients").insert({
            pharmacy_id: tenants[1],
            full_name: "Blocked synthetic write",
            phone: "+9647701234567",
          })
        ).error,
      ).toBe(true);
      expect(
        (
          await admin
            .from("patients")
            .select("id")
            .in("id", [patientA, patientB])
        ).data,
      ).toEqual([]);
      expect(
        (await ownerA.from("patients").select("id").eq("id", patientA)).data
          ?.length,
      ).toBe(1);
    });
    it("records immutable/idempotent dispensing, independent medication history and contact outcomes", async () => {
      const event = {
        request_id: crypto.randomUUID(),
        patient_id: patientA,
        medication_id: medicineA,
        dispensed_on: today(),
        quantity: 30,
        days_supply: 30,
        lead_days: 2,
        carry_days: 0,
        carry_reviewed: false,
      };
      expect(
        !!(
          await technician.rpc("record_dispensing", {
            p_pharmacy: tenants[0],
            p_input: event,
          })
        ).error,
      ).toBe(true);
      const first = await ok(
        await pharmacist.rpc("record_dispensing", {
          p_pharmacy: tenants[0],
          p_input: event,
        }),
        "First dispensing",
      );
      expect(
        await ok(
          await pharmacist.rpc("record_dispensing", {
            p_pharmacy: tenants[0],
            p_input: event,
          }),
          "Replay dispensing",
        ),
      ).toBe(first);
      await ok(
        await pharmacist.rpc("record_dispensing", {
          p_pharmacy: tenants[0],
          p_input: {
            ...event,
            request_id: crypto.randomUUID(),
            days_supply: 60,
          },
        }),
        "Second dispensing",
      );
      const history = await ok(
        await ownerA
          .from("dispensing_events")
          .select("id,last_covered_on")
          .eq("medication_id", medicineA),
        "Read dispensing history",
      );
      expect(history.length).toBe(2);
      expect(
        history.some((e) => e.last_covered_on === shiftDate(today(), 29)),
      ).toBe(true);
      await ok(
        await technician
          .from("patient_contact_events")
          .insert({
            pharmacy_id: tenants[0],
            patient_id: patientA,
            medication_id: medicineA,
            outcome: "contacted",
          })
          .select("id"),
        "Save contact",
      );
      expect(
        (
          await ownerA
            .from("patient_contact_events")
            .select("id")
            .eq("patient_id", patientA)
        ).data?.length,
      ).toBe(1);
      expect(
        !!(await ownerA.from("dispensing_events").delete().eq("id", first))
          .error,
      ).toBe(true);
      expect(
        !!(
          await ownerA.rpc("record_dispensing", {
            p_pharmacy: tenants[1],
            p_input: {
              ...event,
              patient_id: patientB,
              medication_id: medicineB,
            },
          })
        ).error,
      ).toBe(true);
    });
    it("uploads a private document and denies cross-tenant metadata/object access", async () => {
      const png = Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=",
        ),
        (c) => c.charCodeAt(0),
      );
      const form = new FormData();
      form.set("pharmacy_id", tenants[0]);
      form.set("patient_id", patientA);
      form.set("category", "prescription");
      form.set("file", new File([png], "synthetic.png", { type: "image/png" }));
      const upload = await call("documents", ownerA, form);
      expect(upload.status).toBe(200);
      const id = (await upload.json()).id;
      const metadata = await ok(
        await ownerA
          .from("patient_documents")
          .select("object_path")
          .eq("id", id)
          .single(),
        "Read private metadata",
      );
      paths.push(metadata.object_path);
      expect(
        (await ownerB.from("patient_documents").select("id").eq("id", id)).data,
      ).toEqual([]);
      expect(
        (
          await call(
            "documents",
            ownerB,
            JSON.stringify({ action: "download", id }),
          )
        ).status,
      ).toBe(404);
      const download = await call(
        "documents",
        ownerA,
        JSON.stringify({ action: "download", id }),
      );
      expect(download.status).toBe(200);
      const signed = (await download.json()).url;
      expect((await fetch(signed)).status).toBe(200);
      expect(
        (
          await fetch(
            `${config.url}/storage/v1/object/public/patient-documents/${metadata.object_path}`,
          )
        ).ok,
      ).toBe(false);
      const direct = await ownerB.storage
        .from("patient-documents")
        .download(metadata.object_path);
      expect(!!direct.error).toBe(true);
      await ok(
        await ownerA.rpc("archive_document", {
          p_pharmacy: tenants[0],
          p_id: id,
        }),
        "Archive document",
      );
      expect(
        (
          await call(
            "documents",
            ownerA,
            JSON.stringify({ action: "download", id }),
          )
        ).status,
      ).toBe(404);
    });
    it("rejects unauthenticated function calls and respects staff suspension immediately", async () => {
      const origin = config.netlifyUrl ?? "http://localhost:8888";
      const req = new Request(`${origin}/api/documents`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{}",
      });
      const response = config.netlifyUrl
        ? await fetch(req)
        : await documents(req);
      expect(response.status).toBe(401);
      await ok(
        await ownerA.rpc("manage_staff", {
          p_pharmacy: tenants[0],
          p_user: users[3].id,
          p_role: "technician",
          p_active: false,
        }),
        "Suspend staff",
      );
      expect(
        (await technician.from("patients").select("id").eq("id", patientA))
          .data,
      ).toEqual([]);
    });
  },
);
