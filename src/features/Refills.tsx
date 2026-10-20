import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Select, Input } from "@fluentui/react-components";
import { useRows, useSave } from "../lib/hooks";
import { latestEvents } from "../lib/data";
import { projection, today, whatsapp } from "../lib/domain";
import {
  DataTable,
  Heading,
  LoadState,
  Notice,
  Status,
} from "../components/common";
export function Refills() {
  const patients = useRows("patients"),
    meds = useRows("patient_medications"),
    events = useRows("dispensing_events"),
    contacts = useRows("patient_contact_events");
  const save = useSave("patient_contact_events");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const rows = latestEvents(events.data ?? [])
    .filter((e) =>
      meds.data?.some((m) => m.id === e.medication_id && m.status === "active"),
    )
    .map((e) => {
      const p = patients.data?.find((p) => p.id === e.patient_id);
      const m = meds.data?.find((m) => m.id === e.medication_id);
      const dates = projection(e as Parameters<typeof projection>[0]);
      const last = (contacts.data ?? [])
        .filter((c) => c.patient_id === e.patient_id)
        .at(-1);
      return {
        ...e,
        ...dates,
        patient_name: p?.full_name ?? "Patient",
        phone: p?.phone,
        consent: p?.communication_consent,
        medicine_name: m?.medicine_name,
        last_contact: last?.outcome ?? "Not contacted",
      };
    })
    .filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        `${r.patient_name} ${r.medicine_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  return (
    <>
      <Heading
        title="Refill & follow-up center"
        subtitle={`Pharmacy date: ${today()} · Supply estimates require pharmacist review`}
      />
      {message && <Notice>{message}</Notice>}
      {save.error && <Notice error>{save.error.message}</Notice>}
      <div className="panel">
        <div className="toolbar">
          <Input
            aria-label="Search refill queue"
            placeholder="Patient or medication"
            value={search}
            onChange={(_, d) => setSearch(d.value)}
          />
          <Select
            aria-label="Filter urgency"
            value={filter}
            onChange={(_, d) => setFilter(d.value)}
          >
            {["all", "overdue", "due_today", "due_soon", "on_track"].map(
              (v) => (
                <option value={v} key={v}>
                  {v.replaceAll("_", " ")}
                </option>
              ),
            )}
          </Select>
        </div>
        <LoadState loading={events.isLoading} error={events.error} />
        <DataTable
          rows={rows}
          columns={[
            {
              key: "patient_name",
              label: "Patient",
              render: (r) => (
                <Link to={`/app/patients/${r.patient_id}`}>
                  {String(r.patient_name)}
                </Link>
              ),
            },
            { key: "medicine_name", label: "Medication" },
            { key: "last_covered_on", label: "Last covered" },
            { key: "contact_on", label: "Contact target" },
            { key: "remaining", label: "Covered days left" },
            {
              key: "status",
              label: "Supply status",
              render: (r) => <Status value={r.status} />,
            },
            { key: "last_contact", label: "Last contact" },
          ]}
          actions={(r) => (
            <>
              <a href={`tel:${r.phone}`}>
                <Button size="small">Call</Button>
              </a>
              <Button
                size="small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(String(r.phone));
                    setMessage("Phone number copied.");
                  } catch {
                    setMessage(
                      "Clipboard unavailable. Select the number from the patient profile.",
                    );
                  }
                }}
              >
                Copy phone
              </Button>
              {!!r.consent && (
                <a
                  href={whatsapp(String(r.phone))}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="small">WhatsApp</Button>
                </a>
              )}
              <Select
                aria-label={`Contact outcome for ${r.patient_name}`}
                value=""
                disabled={save.isPending}
                onChange={(_, d) => {
                  if (d.value)
                    save.mutate(
                      {
                        data: {
                          patient_id: r.patient_id,
                          medication_id: r.medication_id,
                          outcome: d.value,
                          contacted_on: today(),
                        },
                      },
                      {
                        onSuccess: () =>
                          setMessage(
                            "Contact outcome recorded. Dispensing status remains independent.",
                          ),
                      },
                    );
                }}
              >
                <option value="">Record outcome…</option>
                {["contacted", "no_answer", "will_return", "declined"].map(
                  (v) => (
                    <option key={v} value={v}>
                      {v.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </Select>
            </>
          )}
        />
      </div>
    </>
  );
}
