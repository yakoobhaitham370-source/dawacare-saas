import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import {
  Button,
  Field,
  Input,
  Textarea,
  Switch,
  Select,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useAuth } from "../app/context";
import { useRows, useSave, useDispense } from "../lib/hooks";
import {
  clinical,
  normalizeName,
  patientSchema,
  projection,
  today,
} from "../lib/domain";
import type { Row } from "../lib/domain";
import {
  DataTable,
  DynamicFields,
  Heading,
  LoadState,
  Notice,
  Status,
} from "../components/common";
import { PrivateDocuments } from "./Documents";
import { Collection } from "./Collection";
export function Patients() {
  const { t } = useTranslation();
  const q = useRows("patients");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const rows = (q.data ?? []).filter((r) =>
    normalizeName(
      `${r.full_name} ${r.phone} ${r.display_number} ${r.conditions}`,
    ).includes(normalizeName(search)),
  );
  return (
    <>
      <Heading
        title={t("patients")}
        subtitle="Every patient. A continuous story of care."
      >
        <Link to="/app/patients/new">
          <Button appearance="primary">Add patient</Button>
        </Link>
      </Heading>
      <div className="panel">
        <div className="toolbar">
          <Input
            placeholder="Name, phone, patient number or condition"
            aria-label="Search patients"
            value={search}
            onChange={(_, d) => {
              setSearch(d.value);
              setPage(0);
            }}
          />
          <span className="muted">{rows.length} patients</span>
        </div>
        <LoadState loading={q.isLoading} error={q.error} />
        <DataTable
          rows={rows.slice(page * 15, page * 15 + 15)}
          columns={[
            {
              key: "full_name",
              label: "Patient",
              render: (r) => (
                <Link className="patient-link" to={`/app/patients/${r.id}`}>
                  <span className="avatar">
                    {String(r.full_name).slice(0, 1)}
                  </span>
                  <span>
                    <strong>{String(r.full_name)}</strong>
                    <small>
                      DC-{String(r.display_number).padStart(4, "0")}
                    </small>
                  </span>
                </Link>
              ),
            },
            { key: "phone", label: "Phone" },
            { key: "conditions", label: "Conditions" },
            { key: "city", label: "City" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Status value={r.status} />,
            },
          ]}
          actions={(r) => (
            <Link to={`/app/patients/${r.id}`}>
              <Button size="small">Open profile</Button>
            </Link>
          )}
        />
        <div className="pagination">
          <Button disabled={!page} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>Page {page + 1}</span>
          <Button
            disabled={(page + 1) * 15 >= rows.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
type PatientValues = {
  full_name: string;
  phone: string;
  city: string;
  date_of_birth: string;
  conditions: string;
  notes: string;
  communication_consent: boolean;
};
export function PatientForm() {
  const { id } = useParams();
  const q = useRows("patients");
  const mutation = useSave("patients");
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const existing = q.data?.find((r) => r.id === id);
  if (id && q.isLoading) return <LoadState loading error={null} />;
  if (id && !existing) return <Notice error>Patient unavailable.</Notice>;
  return (
    <PatientEditor
      key={id ?? "new"}
      existing={existing}
      rows={q.data ?? []}
      onSave={async (values) => {
        setError("");
        try {
          const parsed = patientSchema.parse(values);
          const r = await mutation.mutateAsync({
            data: {
              ...parsed,
              date_of_birth: parsed.date_of_birth || null,
              status: existing?.status ?? "active",
            },
            id,
          });
          navigate(`/app/patients/${r.id}`);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed");
        }
      }}
      error={error}
      busy={mutation.isPending}
    />
  );
}
function PatientEditor({
  existing,
  rows,
  onSave,
  error,
  busy,
}: {
  existing?: Row;
  rows: Row[];
  onSave: (v: PatientValues) => Promise<void>;
  error: string;
  busy: boolean;
}) {
  const defaults: PatientValues = {
    full_name: String(existing?.full_name ?? ""),
    phone: String(existing?.phone ?? ""),
    city: String(existing?.city ?? "Mosul"),
    date_of_birth: String(existing?.date_of_birth ?? ""),
    conditions: String(existing?.conditions ?? ""),
    notes: String(existing?.notes ?? ""),
    communication_consent: !!existing?.communication_consent,
  };
  const { register, handleSubmit, control, setValue } = useForm<PatientValues>({
    defaultValues: defaults,
  });
  const values = useWatch({ control, defaultValue: defaults }) as PatientValues;
  const matches = rows.filter(
    (r) =>
      r.id !== existing?.id &&
      ((values.phone.length > 6 &&
        String(r.phone).endsWith(values.phone.replace(/\D/g, "").slice(-9))) ||
        (values.full_name.length > 2 &&
          normalizeName(String(r.full_name)) ===
            normalizeName(values.full_name))),
  );
  return (
    <>
      <Heading
        title={existing ? "Edit patient" : "Register a patient"}
        subtitle="Start with the essentials. Add clinical details when verified."
      />
      <form className="panel form-panel" onSubmit={handleSubmit(onSave)}>
        <div className="form-grid">
          <Field label="Full name · الاسم الكامل" required>
            <Input {...register("full_name", { required: true })} />
          </Field>
          <Field label="Iraqi mobile number" required>
            <Input
              {...register("phone", { required: true })}
              type="tel"
              placeholder="07701234567"
            />
          </Field>
          <Field label="City">
            <Input {...register("city")} />
          </Field>
          <Field label="Date of birth (optional)">
            <Input {...register("date_of_birth")} type="date" max={today()} />
          </Field>
          <Field label="Conditions" className="wide">
            <Textarea
              {...register("conditions")}
              placeholder="Patient-reported conditions; do not infer diagnoses"
            />
          </Field>
          <Field label="Notes" className="wide">
            <Textarea {...register("notes")} />
          </Field>
          <Field label="Patient consents to pharmacy contact" className="wide">
            <Switch
              checked={values.communication_consent}
              onChange={(_, d) => setValue("communication_consent", d.checked)}
            />
          </Field>
        </div>
        {matches.length > 0 && (
          <Notice>
            Possible duplicate:{" "}
            {matches.map((r) => String(r.full_name)).join(", ")}. Review
            existing records before saving; records are never merged
            automatically.
          </Notice>
        )}
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <Link to="/app/patients">
            <Button>Cancel</Button>
          </Link>
          <Button appearance="primary" type="submit" disabled={busy}>
            Save patient
          </Button>
        </div>
      </form>
    </>
  );
}
const medicineFields = [
  { key: "medicine_name", label: "Medicine name", required: true },
  { key: "strength", label: "Strength", required: true },
  { key: "form", label: "Pharmaceutical form", required: true },
  { key: "route", label: "Route", required: true },
  {
    key: "instructions",
    label: "Verified dosing instructions",
    type: "textarea" as const,
    required: true,
  },
  {
    key: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: ["active", "paused", "discontinued", "draft"].map((value) => ({
      value,
      label: value,
    })),
  },
];
export function Medications() {
  const { scope } = useAuth();
  return (
    <Collection
      table="patient_medications"
      title="Medications"
      fields={[
        { key: "patient_id", label: "Patient UUID", required: true },
        ...medicineFields,
      ]}
      readonly={!clinical(scope.role)}
      description="Longitudinal treatments. Open a patient to add a medicine with patient context."
    />
  );
}
export function PatientDetail() {
  const { id } = useParams();
  const { scope } = useAuth();
  const patients = useRows("patients");
  const meds = useRows("patient_medications");
  const events = useRows("dispensing_events");
  const archive = useSave("patients");
  const [tab, setTab] = useState("overview");
  const [selected, setSelected] = useState<Row | null>(null);
  const p = patients.data?.find((r) => r.id === id);
  const medicines = (meds.data ?? []).filter((m) => m.patient_id === id);
  const history = (events.data ?? []).filter((e) => e.patient_id === id);
  if (patients.isLoading) return <LoadState loading error={null} />;
  if (!p) return <Notice error>Patient unavailable.</Notice>;
  return (
    <>
      <Heading
        title={String(p.full_name)}
        subtitle={`DC-${String(p.display_number).padStart(4, "0")} · ${p.city} · ${p.phone}`}
      >
        <Link to={`/app/patients/${id}/edit`}>
          <Button>Edit patient</Button>
        </Link>
        <Button
          disabled={archive.isPending}
          onClick={() =>
            archive.mutate({
              id,
              data: { status: p.status === "active" ? "archived" : "active" },
            })
          }
        >
          {p.status === "active" ? "Archive" : "Reactivate"}
        </Button>
      </Heading>
      {archive.error && <Notice error>{archive.error.message}</Notice>}
      <div className="tabs" role="navigation" aria-label="Patient sections">
        {[
          "overview",
          "medications",
          "dispensing",
          "follow-ups",
          "laboratory",
          "documents",
          "activity",
        ].map((t) => (
          <Button
            key={t}
            appearance={tab === t ? "primary" : "subtle"}
            onClick={() => setTab(t)}
          >
            {t.replace("-", " ")}
          </Button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="detail-grid">
          <section className="panel">
            <h2>Patient overview</h2>
            <dl>
              <dt>Status</dt>
              <dd>
                <Status value={p.status} />
              </dd>
              <dt>Conditions</dt>
              <dd>{String(p.conditions || "Not recorded")}</dd>
              <dt>Date of birth</dt>
              <dd>{String(p.date_of_birth || "Not recorded")}</dd>
              <dt>Notes</dt>
              <dd>{String(p.notes || "No notes")}</dd>
              <dt>Contact consent</dt>
              <dd>{p.communication_consent ? "Recorded" : "Not recorded"}</dd>
            </dl>
          </section>
          <section className="panel">
            <h2>Current treatments</h2>
            {medicines.map((m) => (
              <div className="list-item" key={m.id}>
                <div>
                  <strong>{String(m.medicine_name)}</strong>
                  <p>
                    {String(m.strength)} · {String(m.instructions)}
                  </p>
                </div>
                <Status value={m.status} />
              </div>
            ))}
            {!medicines.length && (
              <p>
                No medication records. Add a verified treatment in the
                medications tab.
              </p>
            )}
          </section>
        </div>
      )}
      {tab === "medications" && (
        <>
          <Collection
            table="patient_medications"
            title="Patient medications"
            fields={medicineFields}
            fixed={{ patient_id: id }}
            readonly={!clinical(scope.role)}
          />
          {clinical(scope.role) && (
            <div className="panel">
              <h2>Record a dispensing event</h2>
              {medicines
                .filter((m) => m.status === "active")
                .map((m) => (
                  <Button key={m.id} onClick={() => setSelected(m)}>
                    Dispense {String(m.medicine_name)}
                  </Button>
                ))}
            </div>
          )}
        </>
      )}
      {tab === "dispensing" && (
        <div className="panel">
          <h2>Immutable dispensing history</h2>
          <DataTable
            rows={history}
            columns={[
              { key: "dispensed_on", label: "Dispensed" },
              {
                key: "medication_id",
                label: "Medication",
                render: (r) =>
                  String(
                    medicines.find((m) => m.id === r.medication_id)
                      ?.medicine_name ?? "Medication",
                  ),
              },
              { key: "quantity", label: "Quantity" },
              { key: "days_supply", label: "Confirmed days" },
              { key: "last_covered_on", label: "Last covered date" },
              { key: "correction_reason", label: "Correction reason" },
            ]}
          />
        </div>
      )}
      {tab === "follow-ups" && (
        <Collection
          table="patient_contact_events"
          title="Contact history"
          fixed={{ patient_id: id }}
          fields={[
            {
              key: "outcome",
              label: "Outcome",
              required: true,
              type: "select",
              options: [
                "contacted",
                "no_answer",
                "will_return",
                "declined",
                "rescheduled",
              ].map((value) => ({ value, label: value })),
            },
            {
              key: "next_contact_on",
              label: "Next contact date",
              type: "date",
            },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
        />
      )}{" "}
      {tab === "laboratory" && (
        <Collection
          table="laboratory_results"
          title="Laboratory results"
          fixed={{ patient_id: id }}
          fields={labFields}
          readonly={!clinical(scope.role)}
        />
      )}{" "}
      {tab === "documents" && <PrivateDocuments patientId={id} />}
      {tab === "activity" && (
        <Collection
          table="clinical_audit_logs"
          title="Audit history"
          readonly
          fields={[
            { key: "created_at", label: "Time" },
            { key: "action", label: "Action" },
            { key: "record_id", label: "Record" },
          ]}
        />
      )}{" "}
      {selected && (
        <DispensingForm medicine={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
export const labFields = [
  { key: "test_name", label: "Test name", required: true },
  { key: "result", label: "Result", required: true },
  { key: "unit", label: "Unit" },
  { key: "reference_range", label: "Reference range" },
  {
    key: "collected_on",
    label: "Collection date",
    type: "date" as const,
    required: true,
  },
  { key: "notes", label: "Notes", type: "textarea" as const },
];
function DispensingForm({
  medicine,
  onClose,
}: {
  medicine: Row;
  onClose: () => void;
}) {
  const mutation = useDispense();
  const [values, setValues] = useState<Record<string, unknown>>({
    request_id: crypto.randomUUID(),
    dispensed_on: today(),
    quantity: 30,
    days_supply: 30,
    lead_days: 2,
    carry_days: 0,
    carry_reviewed: false,
  });
  const [error, setError] = useState("");
  let preview: ReturnType<typeof projection> | undefined;
  try {
    preview = projection(values as Parameters<typeof projection>[0]);
  } catch {
    /* Show validation on submission */
  }
  return (
    <div className="panel dispensing-panel">
      <Heading
        title={`Dispense ${medicine.medicine_name}`}
        subtitle="Confirm supply from the prescription. Estimates do not prove adherence."
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await mutation.mutateAsync({
              ...values,
              patient_id: medicine.patient_id,
              medication_id: medicine.id,
            });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
          }
        }}
      >
        <DynamicFields
          fields={[
            {
              key: "dispensed_on",
              label: "Dispensing date",
              type: "date",
              required: true,
            },
            {
              key: "quantity",
              label: "Quantity dispensed",
              type: "number",
              required: true,
              min: 1,
            },
            {
              key: "days_supply",
              label: "Pharmacist-confirmed days supply",
              type: "number",
              min: 1,
              required: true,
            },
            {
              key: "lead_days",
              label: "Contact lead time (days)",
              type: "number",
              min: 0,
              required: true,
            },
            {
              key: "carry_days",
              label: "Explicitly approved carry-over days",
              type: "number",
              min: 0,
            },
            {
              key: "carry_reviewed",
              label: "I reviewed remaining supply and authorize carry-over",
              type: "boolean",
            },
          ]}
          values={values}
          onChange={(k, v) => setValues((x) => ({ ...x, [k]: v }))}
        />
        {preview && (
          <Notice>
            Last covered day: <strong>{preview.last_covered_on}</strong>. Next
            uncovered day: {preview.next_uncovered_on}. Contact target:{" "}
            {preview.contact_on}.
          </Notice>
        )}
        {error && <Notice error>{error}</Notice>}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            type="submit"
            disabled={mutation.isPending}
          >
            Confirm & record dispensing
          </Button>
        </div>
      </form>
    </div>
  );
}
export function Laboratory() {
  const { scope } = useAuth();
  return (
    <Collection
      table="laboratory_results"
      title="Laboratory results"
      fields={[
        { key: "patient_id", label: "Patient UUID", required: true },
        ...labFields,
      ]}
      readonly={!clinical(scope.role)}
    />
  );
}
// Explicit selection is preferable to guessing a patient from a medicine name.
export function PatientSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const q = useRows("patients");
  return (
    <Select value={value} onChange={(_, d) => onChange(d.value)}>
      <option value="">Select patient</option>
      {q.data?.map((p) => (
        <option key={p.id} value={p.id}>
          {String(p.full_name)}
        </option>
      ))}
    </Select>
  );
}
