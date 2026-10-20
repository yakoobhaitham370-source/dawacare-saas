import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  authAs,
  developmentFixture,
  fixture as f,
} from "./development-fixture";
let db: PGlite;
beforeAll(async () => {
  db = await developmentFixture();
}, 30000);
afterAll(async () => {
  if (db) await db.close();
});
afterEach(async () => {
  await db.exec("reset role;delete from pharmacy_invitations");
  await db.query(
    "delete from pharmacy_memberships where user_id=any($1::uuid[])",
    [[f.recipient, f.otherRecipient, f.unverified]],
  );
  await db.exec(
    "update pharmacy_memberships set active=true;update subscriptions set staff_limit=3,status='active',ends_on=current_date+30",
  );
});
async function prepare(
  pharmacy = f.a,
  email = "recipient@example.test",
  role = "pharmacist",
) {
  const result = await db.query<{ id: string }>(
    "select prepare_invitation($1,$2,$3) as id",
    [pharmacy, email, role],
  );
  return result.rows[0].id;
}
async function claim(id: string) {
  const result = await db.query<{ claim: { id: string; lease: string } }>(
    "select claim_invitation_delivery($1) as claim",
    [id],
  );
  return result.rows[0].claim;
}
async function finish(
  id: string,
  lease: string,
  user: string | null,
  success: boolean,
) {
  await db.exec("reset role");
  return db.query<{ done: boolean }>(
    "select finish_invitation_delivery($1,$2,$3,$4) as done",
    [id, lease, user, success],
  );
}
describe("invitation lifecycle and Supabase-style default grants", () => {
  it("revokes inherited public table and service RPC privileges", async () => {
    await db.exec("reset role");
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_table_privilege('anon','public.patients','select') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    for (const table of [
      "pharmacy_memberships",
      "pharmacy_invitations",
      "clinical_audit_logs",
      "dispensing_events",
      "patient_contact_events",
      "subscription_payments",
    ])
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_table_privilege('authenticated',$1,'update') as allowed",
            [`public.${table}`],
          )
        ).rows[0].allowed,
      ).toBe(false);
    await authAs(db, f.owner);
    await expect(
      db.query("select finish_invitation_delivery($1,$2,$3,$4)", [
        crypto.randomUUID(),
        crypto.randomUUID(),
        f.recipient,
        true,
      ]),
    ).rejects.toThrow(/permission/);
    await expect(
      db.query("select register_uploaded_document($1,$2,$3,$4,$5,$6,$7)", [
        f.owner,
        f.a,
        crypto.randomUUID(),
        `${f.a}/fake`,
        "application/pdf",
        10,
        "prescription",
      ]),
    ).rejects.toThrow(/permission/);
  });
  it("blocks an owner from managing another pharmacy or granting owner status", async () => {
    await authAs(db, f.owner);
    await expect(prepare(f.b)).rejects.toThrow(/Forbidden/);
    await expect(
      prepare(f.a, "recipient@example.test", "owner"),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      db.query("select prepare_invitation($1,$2,$3)", [
        f.a,
        "recipient@example.test",
        null,
      ]),
    ).rejects.toThrow(/Forbidden/);
  });
  it("allows a different authorized owner/admin to recover an existing invitation", async () => {
    await authAs(db, f.owner);
    const id = await prepare();
    await authAs(db, f.admin, "aal2");
    expect((await claim(id)).lease).toBeTruthy();
  });
  it("reserves seats while delivery is in progress and blocks concurrent delivery", async () => {
    await authAs(db, f.owner);
    const id = await prepare();
    const delivery = await claim(id);
    await expect(claim(id)).rejects.toThrow(/progress/);
    await expect(prepare(f.a, "otherRecipient@example.test")).rejects.toThrow(
      /seat limit/,
    );
    await finish(id, delivery.lease, null, false);
    await authAs(db, f.owner);
    await expect(claim(id)).rejects.toThrow(/Wait/);
  });
  it("recovers a stale lease without allowing an old delivery to overwrite it", async () => {
    await authAs(db, f.owner);
    const id = await prepare();
    const first = await claim(id);
    await db.exec("reset role");
    await db.query(
      "update pharmacy_invitations set last_delivery_at=now()-interval '3 minutes',delivery_lease_until=now()-interval '1 minute' where id=$1",
      [id],
    );
    await authAs(db, f.owner);
    const second = await claim(id);
    expect(second.lease).not.toBe(first.lease);
    expect(
      (await finish(id, first.lease, f.recipient, true)).rows[0].done,
    ).toBe(false);
    expect(
      (await finish(id, second.lease, f.recipient, true)).rows[0].done,
    ).toBe(true);
  });
  it("accepts exactly one pharmacy explicitly and never reuses an accepted invitation", async () => {
    await authAs(db, f.owner);
    const a = await prepare();
    await authAs(db, f.otherOwner);
    const b = await prepare(f.b);
    await authAs(db, f.recipient);
    expect(
      (await db.query("select * from my_pending_invitations()")).rows,
    ).toHaveLength(2);
    await expect(
      db.query("select accept_pending_invitation()"),
    ).rejects.toThrow(/explicitly/);
    await db.query("select accept_pharmacy_invitation($1)", [a]);
    expect(
      (
        await db.query(
          "select pharmacy_id from pharmacy_memberships where user_id=$1",
          [f.recipient],
        )
      ).rows,
    ).toEqual([{ pharmacy_id: f.a }]);
    expect(
      (
        await db.query<{ count: number }>(
          "select accept_pharmacy_invitation($1) as count",
          [a],
        )
      ).rows[0].count,
    ).toBe(0);
    await db.query("select accept_pharmacy_invitation($1)", [b]);
    expect(
      (
        await db.query(
          "select pharmacy_id from pharmacy_memberships where user_id=$1",
          [f.recipient],
        )
      ).rows,
    ).toHaveLength(2);
  });
  it("allows verified acceptance during delivery without losing it to late completion", async () => {
    await authAs(db, f.owner);
    const id = await prepare();
    const delivery = await claim(id);
    await authAs(db, f.recipient);
    await db.query("select accept_pharmacy_invitation($1)", [id]);
    expect(
      (await finish(id, delivery.lease, f.recipient, true)).rows[0].done,
    ).toBe(false);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from pharmacy_invitations where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("accepted");
  });
  it("rejects a mismatched or unverified identity", async () => {
    await authAs(db, f.owner);
    const id = await prepare(f.a, "unverified@example.test");
    await authAs(db, f.unverified);
    await expect(
      db.query("select accept_pharmacy_invitation($1)", [id]),
    ).rejects.toThrow(/Verified/);
    await authAs(db, f.recipient);
    await expect(
      db.query("select accept_pharmacy_invitation($1)", [id]),
    ).rejects.toThrow(/unavailable/);
    expect(
      (await db.query("select * from my_pending_invitations()")).rows,
    ).toHaveLength(0);
  });
  it("rejects expired/revoked invitations and renews only when a seat is available", async () => {
    await authAs(db, f.owner);
    const id = await prepare();
    await db.exec("reset role");
    await db.query(
      "update pharmacy_invitations set expires_at=now()-interval '1 minute' where id=$1",
      [id],
    );
    await authAs(db, f.recipient);
    await expect(
      db.query("select accept_pharmacy_invitation($1)", [id]),
    ).rejects.toThrow(/expired/);
    await authAs(db, f.owner);
    await db.query("select manage_invitation($1,$2)", [id, "renew"]);
    await db.query("select manage_invitation($1,$2)", [id, "revoke"]);
    await authAs(db, f.recipient);
    await expect(
      db.query("select accept_pharmacy_invitation($1)", [id]),
    ).rejects.toThrow(/closed/);
    await db.exec("reset role");
    await db.query(
      "update subscriptions set staff_limit=2 where pharmacy_id=$1",
      [f.a],
    );
    await authAs(db, f.owner);
    await expect(
      db.query("select manage_invitation($1,$2)", [id, "renew"]),
    ).rejects.toThrow(/seat limit/);
  });
  it("revalidates the inviter, subscription, and lowered seat limit at acceptance", async () => {
    await authAs(db, f.owner);
    const id = await prepare();
    await db.exec("reset role");
    await db.query(
      "update pharmacy_memberships set active=false where user_id=$1",
      [f.owner],
    );
    await authAs(db, f.recipient);
    await expect(
      db.query("select accept_pharmacy_invitation($1)", [id]),
    ).rejects.toThrow(/revoked/);
    await db.exec("reset role");
    await db.query(
      "update pharmacy_memberships set active=true where user_id=$1",
      [f.owner],
    );
    await db.query(
      "update subscriptions set staff_limit=2 where pharmacy_id=$1",
      [f.a],
    );
    await authAs(db, f.recipient);
    await expect(
      db.query("select accept_pharmacy_invitation($1)", [id]),
    ).rejects.toThrow(/seat limit/);
    await db.exec("reset role");
    await db.query(
      "update subscriptions set staff_limit=3,status='suspended' where pharmacy_id=$1",
      [f.a],
    );
    await authAs(db, f.recipient);
    await expect(
      db.query("select accept_pharmacy_invitation($1)", [id]),
    ).rejects.toThrow(/Subscription/);
  });
  it("prevents invitations from silently escalating/reactivating an existing member", async () => {
    await authAs(db, f.owner);
    await expect(
      prepare(f.a, "tech@example.test", "pharmacist"),
    ).rejects.toThrow(/already exists/);
  });
  it("validates all tenant tables have RLS and immutable audit APIs", async () => {
    await db.exec("reset role");
    expect(
      (
        await db.query(
          "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
        )
      ).rows,
    ).toHaveLength(0);
    await authAs(db, f.owner);
    await expect(db.exec("delete from clinical_audit_logs")).rejects.toThrow(
      /permission/,
    );
    await expect(
      db.exec("delete from administrative_audit_logs"),
    ).rejects.toThrow(/permission/);
  });
  it("does not accept a changed clinical carry-over or reminder policy as an idempotent retry", async () => {
    await authAs(db, f.owner);
    const patient = await db.query<{ id: string }>(
      "insert into patients(pharmacy_id,full_name,phone) values($1,$2,$3) returning id",
      [f.a, "Synthetic replay fixture", "+9647701234567"],
    );
    const medication = await db.query<{ id: string }>(
      "insert into patient_medications(pharmacy_id,patient_id,medicine_name,strength,form,route,instructions,status) values($1,$2,'Synthetic medicine','500 mg','Tablet','Oral','Synthetic directions','active') returning id",
      [f.a, patient.rows[0].id],
    );
    const input = {
      request_id: crypto.randomUUID(),
      patient_id: patient.rows[0].id,
      medication_id: medication.rows[0].id,
      dispensed_on: "2026-10-20",
      quantity: 30,
      days_supply: 30,
      lead_days: 2,
      carry_days: 0,
      carry_reviewed: false,
    };
    await db.query("select record_dispensing($1,$2)", [f.a, input]);
    await expect(
      db.query("select record_dispensing($1,$2)", [
        f.a,
        { ...input, carry_days: 3, carry_reviewed: true },
      ]),
    ).rejects.toThrow(/different input/);
    await expect(
      db.query("select record_dispensing($1,$2)", [
        f.a,
        { ...input, lead_days: 5 },
      ]),
    ).rejects.toThrow(/different input/);
  });
  it("repairs an existing public patient bucket without deleting its contents", async () => {
    await db.exec("reset role");
    const bucket = await db.query<{
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id='patient-documents'",
    );
    expect(bucket.rows[0].public).toBe(false);
    expect(Number(bucket.rows[0].file_size_limit)).toBe(5242880);
    expect(bucket.rows[0].allowed_mime_types).toEqual([
      "image/jpeg",
      "image/png",
      "application/pdf",
    ]);
  });
  it("revalidates a replacement sender when recovering a revoked inviter", async () => {
    await authAs(db, f.owner);
    const id = await prepare();
    await db.exec("reset role");
    await db.query(
      "update pharmacy_memberships set active=false where user_id=$1",
      [f.owner],
    );
    await authAs(db, f.admin, "aal2");
    const delivery = await claim(id);
    await finish(id, delivery.lease, f.recipient, true);
    await authAs(db, f.recipient);
    expect(
      (
        await db.query<{ accepted: number }>(
          "select accept_pharmacy_invitation($1) as accepted",
          [id],
        )
      ).rows[0].accepted,
    ).toBe(1);
  });
});
