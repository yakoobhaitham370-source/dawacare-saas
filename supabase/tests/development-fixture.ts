import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
export const fixture = {
  a: "11000000-0000-4000-8000-000000000001",
  b: "11000000-0000-4000-8000-000000000002",
  owner: "21000000-0000-4000-8000-000000000001",
  otherOwner: "21000000-0000-4000-8000-000000000002",
  admin: "21000000-0000-4000-8000-000000000003",
  tech: "21000000-0000-4000-8000-000000000004",
  recipient: "21000000-0000-4000-8000-000000000005",
  unverified: "21000000-0000-4000-8000-000000000006",
  otherRecipient: "21000000-0000-4000-8000-000000000007",
};
export async function authAs(db: PGlite, user: string, aal = "aal1") {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [user, JSON.stringify({ sub: user, role: "authenticated", aal })],
  );
  await db.exec("set role authenticated");
}
export async function developmentFixture() {
  const db = new PGlite();
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated,service_role;grant execute on all functions in schema auth to authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,name text,bucket_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;
 insert into storage.buckets values('patient-documents','patient-documents',true,20971520,array['*']);
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  for (const [name, id] of Object.entries(fixture).filter(
    ([name]) => !["a", "b"].includes(name),
  ))
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${name}@example.test`,
      name === "unverified" ? null : new Date().toISOString(),
    ]);
  await db.query("insert into platform_admins(user_id) values($1)", [
    fixture.admin,
  ]);
  await db.query(
    "insert into pharmacies(id,name,city) values($1,'Pharmacy A','Mosul'),($2,'Pharmacy B','Mosul')",
    [fixture.a, fixture.b],
  );
  await db.exec(
    "insert into subscription_plans(id,name,price,staff_limit,patient_limit) values('51000000-0000-4000-8000-000000000001','Development',0,3,10)",
  );
  await db.exec(
    "insert into subscriptions(pharmacy_id,plan_id,status,starts_on,ends_on,staff_limit,patient_limit) select id,'51000000-0000-4000-8000-000000000001','active',current_date-1,current_date+30,3,10 from pharmacies",
  );
  await db.query(
    "insert into pharmacy_memberships(pharmacy_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner'),($1,$5,'technician')",
    [fixture.a, fixture.owner, fixture.b, fixture.otherOwner, fixture.tech],
  );
  return db;
}
