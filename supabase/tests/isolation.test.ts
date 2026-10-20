import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
const owner = "20000000-0000-4000-8000-000000000001",
  tech = "20000000-0000-4000-8000-000000000002",
  admin = "20000000-0000-4000-8000-000000000003";
const pa = "30000000-0000-4000-8000-000000000001",
  pb = "30000000-0000-4000-8000-000000000002",
  ma = "40000000-0000-4000-8000-000000000001",
  mb = "40000000-0000-4000-8000-000000000002";
async function login(user: string, aal = "aal1") {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${user}',false);select set_config('request.jwt.claims','{"aal":"${aal}"}',false);set role authenticated;`,
  );
}
async function root(sql: string) {
  await db.exec("reset role");
  return db.exec(sql);
}
beforeAll(async () => {
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,name text,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(
    `insert into auth.users values('${owner}','owner@example.invalid',now()),('${tech}','tech@example.invalid',now()),('${admin}','admin@example.invalid',now());insert into public.platform_admins values('${admin}',now());insert into public.pharmacies(id,name,city) values('${a}','Pharmacy A','Mosul'),('${b}','Pharmacy B','Mosul');insert into public.subscription_plans(id,name,price,staff_limit,patient_limit,ai_limit) values('50000000-0000-4000-8000-000000000001','Trial',0,3,10,0);insert into public.subscriptions(pharmacy_id,plan_id,status,starts_on,ends_on,staff_limit,patient_limit) select id,'50000000-0000-4000-8000-000000000001','trial',current_date-1,current_date+30,3,10 from public.pharmacies;insert into public.pharmacy_memberships(pharmacy_id,user_id,role) values('${a}','${owner}','owner'),('${a}','${tech}','technician');select set_config('request.jwt.claim.sub','${owner}',false);insert into public.patients(id,pharmacy_id,full_name,phone) values('${pa}','${a}','Patient A','+9647701234567'),('${pb}','${b}','Patient B','+9647501234567');insert into public.patient_medications(id,pharmacy_id,patient_id,medicine_name,strength,form,route,instructions,status) values('${ma}','${a}','${pa}','Metformin','500 mg','Tablet','Oral','As prescribed','active'),('${mb}','${b}','${pb}','Amlodipine','5 mg','Tablet','Oral','As prescribed','active');`,
  );
}, 30000);
afterAll(() => db.close());
describe("actual PostgreSQL RLS and integrity (PGlite, not hosted Supabase)", () => {
  it("permits only own-tenant patient and medication reads", async () => {
    await login(owner);
    expect((await db.query("select id from patients")).rows).toEqual([
      { id: pa },
    ]);
    expect((await db.query("select id from patient_medications")).rows).toEqual(
      [{ id: ma }],
    );
  });
  it("rejects cross-tenant inserts and silently filters cross-tenant updates", async () => {
    await login(owner);
    await expect(
      db.exec(
        `insert into patients(pharmacy_id,full_name,phone) values('${b}','Attack','+9647701234567')`,
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          `update patients set full_name='Attack' where id='${pb}' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("rejects cross-tenant clinical relationships even for a privileged SQL caller", async () => {
    await root("");
    await expect(
      db.exec(
        `insert into patient_medications(pharmacy_id,patient_id,medicine_name,strength,form,route,instructions) values('${a}','${pb}','Bad link','','','','')`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });
  it("blocks tenant reassignment, spoofed creator, role escalation and tenant creation", async () => {
    await login(owner);
    await expect(
      db.exec(`update patients set pharmacy_id='${b}' where id='${pa}'`),
    ).rejects.toThrow(/Immutable/);
    await db.exec(`update patients set created_by='${admin}' where id='${pa}'`);
    expect(
      (
        await db.query<{ created_by: string }>(
          `select created_by from patients where id='${pa}'`,
        )
      ).rows[0].created_by,
    ).toBe(owner);
    await expect(
      db.exec(
        `update pharmacy_memberships set role='owner' where user_id='${tech}'`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into pharmacies(name,city) values('Unauthorized','Mosul')`,
      ),
    ).rejects.toThrow();
  });
  it("blocks technician clinical finalization and active medication writes", async () => {
    await login(tech);
    await expect(
      db.query("select record_dispensing($1,$2)", [
        a,
        {
          patient_id: pa,
          medication_id: ma,
          dispensed_on: "2026-10-20",
          quantity: 30,
          days_supply: 30,
        },
      ]),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      db.exec(
        `insert into patient_medications(pharmacy_id,patient_id,medicine_name,strength,form,route,instructions,status) values('${a}','${pa}','Bad','','','','','active')`,
      ),
    ).rejects.toThrow();
  });
  it("preserves independent dispensing history and atomically updates projections/tasks", async () => {
    await login(owner);
    const input = {
      patient_id: pa,
      medication_id: ma,
      dispensed_on: "2026-10-20",
      quantity: 30,
      days_supply: 30,
    };
    await db.query("select record_dispensing($1,$2)", [a, input]);
    await db.query("select record_dispensing($1,$2)", [
      a,
      { ...input, quantity: 60, days_supply: 60 },
    ]);
    const result = await db.query<{
      last_covered_on: string;
      contact_on: string;
    }>(
      `select last_covered_on::text,contact_on::text from dispensing_events order by days_supply`,
    );
    expect(result.rows[0]).toEqual({
      last_covered_on: "2026-11-18",
      contact_on: "2026-11-16",
    });
    expect(result.rows).toHaveLength(2);
    expect(
      (await db.query("select * from refill_projections")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from refill_tasks where status='pending'"))
        .rows,
    ).toHaveLength(1);
    await expect(db.exec("delete from dispensing_events")).rejects.toThrow();
    await expect(
      db.exec("update dispensing_events set days_supply=1"),
    ).rejects.toThrow();
  });
  it("denies cross-tenant RPC dispensing", async () => {
    await login(owner);
    await expect(
      db.query("select record_dispensing($1,$2)", [
        b,
        {
          patient_id: pb,
          medication_id: mb,
          dispensed_on: "2026-10-20",
          quantity: 30,
          days_supply: 30,
        },
      ]),
    ).rejects.toThrow(/Forbidden/);
  });
  it("enforces the subscription expiry on writes while preserving retention reads", async () => {
    await root(
      `update subscriptions set ends_on=current_date-1,starts_on=current_date-30 where pharmacy_id='${a}'`,
    );
    await login(owner);
    await expect(
      db.exec(
        `update patients set city='Baghdad' where id='${pa}' returning id`,
      ),
    ).resolves.toBeDefined();
    expect(
      (await db.query(`select city from patients where id='${pa}'`)).rows,
    ).toEqual([{ city: "" }]);
    await expect(
      db.exec(
        `insert into patients(pharmacy_id,full_name,phone) values('${a}','New patient','+9647701234567')`,
      ),
    ).rejects.toThrow();
    await root(
      `update subscriptions set ends_on=current_date+30 where pharmacy_id='${a}'`,
    );
  });
  it("does not grant platform administrators clinical access; requires MFA for administration", async () => {
    await login(admin);
    expect(
      (await db.query("select * from subscription_plans")).rows,
    ).toHaveLength(0);
    await login(admin, "aal2");
    expect(
      (await db.query("select * from subscription_plans")).rows,
    ).toHaveLength(1);
    expect((await db.query("select * from patients")).rows).toHaveLength(0);
  });
  it("reserves seats, rejects technician invitations and owner role escalation", async () => {
    await login(tech);
    await expect(
      db.query("select prepare_invitation($1,$2,$3)", [
        a,
        "new@example.invalid",
        "pharmacist",
      ]),
    ).rejects.toThrow(/Forbidden/);
    await login(owner);
    await expect(
      db.query("select prepare_invitation($1,$2,$3)", [
        a,
        "new@example.invalid",
        "owner",
      ]),
    ).rejects.toThrow(/Forbidden/);
    await db.query("select prepare_invitation($1,$2,$3)", [
      a,
      "new@example.invalid",
      "pharmacist",
    ]);
    await expect(
      db.query("select prepare_invitation($1,$2,$3)", [
        a,
        "second@example.invalid",
        "technician",
      ]),
    ).rejects.toThrow(/seat limit/i);
  });
  it("rejects forged payment confirmation and cross-tenant payment reads", async () => {
    await root(
      `insert into subscription_invoices(id,pharmacy_id,invoice_number,amount,due_on) values('60000000-0000-4000-8000-000000000001','${b}','B-001',1000,current_date)`,
    );
    await login(admin, "aal2");
    await expect(
      db.exec(
        `insert into subscription_payments(pharmacy_id,invoice_id,amount,paid_on,method,confirmed_by,confirmed_at) values('${b}','60000000-0000-4000-8000-000000000001',1000,current_date,'cash','${admin}',now())`,
      ),
    ).rejects.toThrow(/audited/);
    await db.exec(
      `insert into subscription_payments(pharmacy_id,invoice_id,amount,paid_on,method) values('${b}','60000000-0000-4000-8000-000000000001',1000,current_date,'cash')`,
    );
    await login(owner);
    expect(
      (await db.query("select * from subscription_payments")).rows,
    ).toHaveLength(0);
  });
  it("blocks audit deletion and unregistered private objects", async () => {
    await login(owner);
    await expect(db.exec("delete from clinical_audit_logs")).rejects.toThrow();
    await root(
      `insert into storage.objects values(gen_random_uuid(),'${b}/hidden.pdf','patient-documents')`,
    );
    await login(owner);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
  });
  it("enforces patient plan limits server-side", async () => {
    await root(
      `update subscriptions set patient_limit=1 where pharmacy_id='${a}'`,
    );
    await login(owner);
    await expect(
      db.exec(
        `insert into patients(pharmacy_id,full_name,phone) values('${a}','Beyond limit','+9647701234567')`,
      ),
    ).rejects.toThrow(/limit/);
  });
  it("provisions a pharmacy transactionally and rolls back invalid owner invitations", async () => {
    await login(admin, "aal2");
    const input = {
      name: "Pharmacy C",
      city: "Mosul",
      owner_email: "new-owner@example.invalid",
      plan_id: "50000000-0000-4000-8000-000000000001",
      starts_on: "2026-10-20",
      ends_on: "2026-11-20",
    };
    const created = await db.query<{
      result: { pharmacy_id: string; invitation_id: string };
    }>("select provision_pharmacy($1) as result", [input]);
    expect(created.rows[0].result.pharmacy_id).toBeTruthy();
    expect(
      (await db.query("select * from pharmacies where name='Pharmacy C'")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("select provision_pharmacy($1)", [
        { ...input, name: "Rollback pharmacy", owner_email: "invalid" },
      ]),
    ).rejects.toThrow(/Invalid invitation/);
    expect(
      (
        await db.query(
          "select * from pharmacies where name='Rollback pharmacy'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("prevents self promotion, suspends staff immediately, and retains role boundaries", async () => {
    await login(owner);
    await expect(
      db.query("select manage_staff($1,$2,$3,$4)", [
        a,
        owner,
        "pharmacist",
        true,
      ]),
    ).rejects.toThrow(/Forbidden/);
    await db.query("select manage_staff($1,$2,$3,$4)", [
      a,
      tech,
      "technician",
      false,
    ]);
    await login(tech);
    expect((await db.query("select * from patients")).rows).toHaveLength(0);
    await root(
      `update pharmacy_memberships set active=true where user_id='${tech}'`,
    );
  });
  it("consumes AI allowance without creating patients and rejects unreviewed persistence", async () => {
    await root(`update subscriptions set ai_limit=1 where pharmacy_id='${a}'`);
    await login(owner);
    const job = await db.query<{ id: string }>(
      "select reserve_ai_request($1,$2) as id",
      [a, "test-model"],
    );
    await expect(
      db.query("select reserve_ai_request($1,$2)", [a, "test-model"]),
    ).rejects.toThrow(/allowance/);
    await expect(
      db.query("select commit_extraction($1,$2,$3,$4,$5)", [
        a,
        job.rows[0].id,
        pa,
        {},
        false,
      ]),
    ).rejects.toThrow(/verification/);
    expect((await db.query("select * from patients")).rows).toHaveLength(1);
  });
  it("validates tenant document paths and private object reads", async () => {
    await login(owner);
    await root("");
    await expect(
      db.query("select register_document($1,$2,$3,$4,$5,$6)", [
        a,
        pa,
        `${b}/forged`,
        "application/pdf",
        100,
        "prescription",
      ]),
    ).rejects.toThrow();
    await db.query("select register_document($1,$2,$3,$4,$5,$6)", [
      a,
      pa,
      `${a}/private`,
      "application/pdf",
      100,
      "prescription",
    ]);
    await root(
      `insert into storage.objects values(gen_random_uuid(),'${a}/private','patient-documents')`,
    );
    await login(owner);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await login(admin, "aal2");
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
  });
  it("replays dispensing requests idempotently", async () => {
    await login(owner);
    const input = {
      request_id: "70000000-0000-4000-8000-000000000001",
      patient_id: pa,
      medication_id: ma,
      dispensed_on: "2026-10-20",
      quantity: 30,
      days_supply: 30,
    };
    const first = await db.query<{ id: string }>(
      "select record_dispensing($1,$2) as id",
      [a, input],
    );
    const replay = await db.query("select record_dispensing($1,$2) as id", [
      a,
      input,
    ]);
    expect(first.rows).toEqual(replay.rows);
    expect(
      (
        await db.query(
          "select * from refill_tasks where dispensing_event_id=$1",
          [first.rows[0].id],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      db.query("select record_dispensing($1,$2)", [
        a,
        { ...input, quantity: 99 },
      ]),
    ).rejects.toThrow(/different input/);
  });
});
