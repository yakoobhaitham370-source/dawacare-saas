import { useState } from "react";
import { Button, Field, Input, Select } from "@fluentui/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../app/context";
import { supabase } from "../lib/data";
import { useRows } from "../lib/hooks";
import {
  DataTable,
  DynamicFields,
  Heading,
  Notice,
  Status,
} from "../components/common";
import { adminCollections } from "./Other";
import { Collection } from "./Collection";
import { today, shiftDate } from "../lib/domain";
async function rpc(name: string, args: Record<string, unknown>) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
async function deliver(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data } = await supabase.auth.getSession();
  const response = await fetch("/api/invite", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session?.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invitation_id: id }),
  });
  if (!response.ok)
    throw new Error(
      "Invitation delivery failed. The reserved invitation can be retried after the service is configured.",
    );
}
export function Pharmacies() {
  const { scope } = useAuth();
  const query = useRows("pharmacies"),
    plans = useRows("subscription_plans");
  const cache = useQueryClient();
  const [values, setValues] = useState<Record<string, unknown>>({
      starts_on: today(),
      ends_on: shiftDate(today(), 30),
    }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  return (
    <>
      <Heading
        title="Pharmacy directory"
        subtitle="Provision tenant, subscription and owner invitation in one database transaction."
      />
      {scope.sandbox && (
        <Notice>
          Live tenant provisioning and invitation delivery are unavailable in
          the synthetic sandbox. Test clinical workflows using its existing
          synthetic pharmacy.
        </Notice>
      )}
      <div className="panel">
        <DataTable
          rows={query.data ?? []}
          columns={[
            { key: "name", label: "Pharmacy" },
            { key: "city", label: "City" },
            { key: "owner_email", label: "Owner email" },
            { key: "phone", label: "Phone" },
          ]}
        />
      </div>
      <section className="panel form-panel">
        <h2>Create pharmacy</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            setError("");
            try {
              const result = (await rpc("provision_pharmacy", {
                p_input: values,
              })) as { pharmacy_id: string; invitation_id: string };
              await cache.invalidateQueries({ queryKey: ["records"] });
              setMessage(
                `Pharmacy created. Invitation reserved: ${result.invitation_id}`,
              );
              await deliver(result.invitation_id);
              setMessage("Pharmacy created and owner invitation sent.");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unable to provision.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <DynamicFields
            fields={[
              { key: "name", label: "Pharmacy name", required: true },
              { key: "city", label: "City", required: true },
              { key: "phone", label: "Business phone" },
              {
                key: "owner_email",
                label: "Owner email",
                type: "email",
                required: true,
              },
              {
                key: "plan_id",
                label: "Subscription plan",
                type: "select",
                required: true,
                options: (plans.data ?? [])
                  .filter((p) => p.active)
                  .map((p) => ({ value: p.id, label: String(p.name) })),
              },
              {
                key: "starts_on",
                label: "Starts on",
                type: "date",
                required: true,
              },
              {
                key: "ends_on",
                label: "Ends on",
                type: "date",
                required: true,
              },
            ]}
            values={values}
            onChange={(k, v) => setValues((x) => ({ ...x, [k]: v }))}
          />
          <Button
            appearance="primary"
            type="submit"
            disabled={scope.sandbox || busy}
          >
            Create pharmacy & invite owner
          </Button>
        </form>
        {message && <Notice>{message}</Notice>}
        {error && <Notice error>{error}</Notice>}
      </section>
    </>
  );
}
export function StaffManagement() {
  const { scope } = useAuth();
  const q = useRows("pharmacy_memberships"),
    invites = useRows("pharmacy_invitations");
  const cache = useQueryClient();
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("pharmacist"),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function perform(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setMessage(success);
      await cache.invalidateQueries({ queryKey: ["records"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Pharmacy team"
        subtitle="Invitations reserve licensed seats until accepted, revoked or expired."
      />
      {scope.sandbox && (
        <Notice>
          Staff account provisioning requires Supabase and the invitation
          service. Sandbox role switching in the header is for testing only.
        </Notice>
      )}
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
      <div className="panel">
        <DataTable
          rows={q.data ?? []}
          columns={[
            { key: "user_id", label: "User" },
            { key: "role", label: "Role" },
            { key: "active", label: "Active" },
          ]}
          actions={
            scope.role === "owner"
              ? (r) =>
                  r.role !== "owner" ? (
                    <>
                      <Button
                        disabled={scope.sandbox || busy}
                        onClick={() =>
                          void perform(
                            () =>
                              rpc("manage_staff", {
                                p_pharmacy: scope.tenant,
                                p_user: r.user_id,
                                p_role: r.role,
                                p_active: !r.active,
                              }),
                            "Membership updated.",
                          )
                        }
                      >
                        {r.active ? "Suspend" : "Reactivate"}
                      </Button>
                      <Select
                        disabled={scope.sandbox || busy}
                        aria-label={`Role for ${r.user_id}`}
                        value={String(r.role)}
                        onChange={(_, d) =>
                          void perform(
                            () =>
                              rpc("manage_staff", {
                                p_pharmacy: scope.tenant,
                                p_user: r.user_id,
                                p_role: d.value,
                                p_active: r.active,
                              }),
                            "Role updated.",
                          )
                        }
                      >
                        <option value="pharmacist">Pharmacist</option>
                        <option value="technician">Technician</option>
                      </Select>
                    </>
                  ) : null
              : undefined
          }
        />
      </div>
      {scope.role === "owner" && (
        <section className="panel form-panel">
          <h2>Invite a staff member</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await perform(async () => {
                const id = await rpc("prepare_invitation", {
                  p_pharmacy: scope.tenant,
                  p_email: email,
                  p_role: role,
                });
                setMessage(`Invitation reserved: ${id}.`);
                await deliver(String(id));
              }, "Staff invitation sent.");
            }}
          >
            <div className="form-grid">
              <Field label="Staff email" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(_, d) => setEmail(d.value)}
                  required
                />
              </Field>
              <Field label="Role">
                <Select value={role} onChange={(_, d) => setRole(d.value)}>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="technician">Technician</option>
                </Select>
              </Field>
            </div>
            <Button
              appearance="primary"
              type="submit"
              disabled={scope.sandbox || busy}
            >
              Reserve seat & send invitation
            </Button>
          </form>
          <h2 className="spaced">Invitation delivery</h2>
          <DataTable
            rows={invites.data ?? []}
            columns={[
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              {
                key: "status",
                label: "Status",
                render: (r) => <Status value={r.status} />,
              },
              { key: "expires_at", label: "Expires" },
            ]}
            actions={(r) =>
              ["pending", "failed"].includes(String(r.status)) ? (
                <Button
                  disabled={scope.sandbox || busy}
                  onClick={() =>
                    void perform(() => deliver(r.id), "Invitation delivered.")
                  }
                >
                  Retry delivery
                </Button>
              ) : null
            }
          />
        </section>
      )}
    </>
  );
}
export function Payments() {
  const { scope } = useAuth();
  const q = useRows("subscription_payments");
  const cache = useQueryClient();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Collection title="Manual payments" {...adminCollections.payments} />
      <section className="panel">
        <h2>Payment confirmation</h2>
        <p>
          Confirm only after independently verifying receipt. Recorded methods
          or references do not prove payment.
        </p>
        {error && <Notice error>{error}</Notice>}
        <DataTable
          rows={q.data ?? []}
          columns={[
            { key: "reference", label: "Reference" },
            { key: "amount", label: "Amount" },
            { key: "currency", label: "Currency" },
            { key: "confirmed_at", label: "Confirmed at" },
          ]}
          actions={(r) =>
            r.confirmed_at ? (
              <Status value="confirmed" />
            ) : (
              <Button
                disabled={scope.sandbox || busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await rpc("confirm_payment", { p_payment: r.id });
                    await cache.invalidateQueries({ queryKey: ["records"] });
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Confirmation failed",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Confirm received payment
              </Button>
            )
          }
        />
        {scope.sandbox && (
          <small>
            Payment confirmation is disabled in the synthetic sandbox.
          </small>
        )}
      </section>
    </>
  );
}
