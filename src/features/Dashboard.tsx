import { Link } from "react-router-dom";
import { Button } from "@fluentui/react-components";
import {
  PeopleRegular,
  CalendarClockRegular,
  WarningRegular,
  CheckmarkCircleRegular,
  ArrowRightRegular,
} from "@fluentui/react-icons";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useTranslation } from "react-i18next";
import { useRows } from "../lib/hooks";
import { latestEvents } from "../lib/data";
import type { Row } from "../lib/domain";
import { projection, shiftDate, today } from "../lib/domain";
import { DataTable, Heading, LoadState, Status } from "../components/common";
export function Dashboard() {
  const { t } = useTranslation();
  const patients = useRows("patients"),
    events = useRows("dispensing_events"),
    meds = useRows("patient_medications");
  const active = (patients.data ?? []).filter((p) => p.status === "active");
  const projections: (Row & ReturnType<typeof projection>)[] = latestEvents(
    events.data ?? [],
  )
    .filter((e) =>
      meds.data?.some((m) => m.id === e.medication_id && m.status === "active"),
    )
    .map((e) => ({
      ...e,
      ...projection(e as Parameters<typeof projection>[0]),
    }));
  const overdue = projections.filter((p) => p.status === "overdue");
  const due = projections.filter(
    (p) => p.contact_on <= today() && p.status !== "overdue",
  );
  const attention = [...overdue, ...due].map((e) => ({
    ...e,
    full_name: patients.data?.find((p) => p.id === e.patient_id)?.full_name,
    medicine_name: meds.data?.find((m) => m.id === e.medication_id)
      ?.medicine_name,
  }));
  const chart = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(today(), i);
    return {
      date: date.slice(5),
      count: projections.filter((p) => p.contact_on === date).length,
    };
  });
  return (
    <>
      <Heading title={t("welcome")} subtitle={t("subtitle")}>
        <Link to="/app/patients/new">
          <Button appearance="primary">+ Register patient</Button>
        </Link>
      </Heading>
      <div className="care-banner">
        <div>
          <span className="eyebrow">THE DAILY PULSE</span>
          <h2>
            A little follow-up.
            <br />A lasting difference.
          </h2>
          <p>
            Stay close to your patients’ next refill.
            <br />
            Start with the people who need your attention today.
          </p>
          <Link to="/app/refills">
            <Button icon={<ArrowRightRegular />} iconPosition="after">
              Open refill queue
            </Button>
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <span className="art-cross">+</span>
          <span className="art-dot one" />
          <span className="art-dot two" />
          <span className="art-line" />
        </div>
      </div>
      <LoadState
        loading={patients.isLoading || events.isLoading}
        error={patients.error ?? events.error}
      />
      <div className="stats-grid">
        {[
          {
            label: "Active patients",
            value: active.length,
            icon: <PeopleRegular />,
            note: "Registered in your pharmacy",
            color: "teal",
          },
          {
            label: "Contact due",
            value: due.length,
            icon: <CalendarClockRegular />,
            note: "At or past contact target",
            color: "blue",
          },
          {
            label: "Overdue supply estimates",
            value: overdue.length,
            icon: <WarningRegular />,
            note: "Past last expected covered day",
            color: "orange",
          },
          {
            label: "Dispensing events",
            value: events.data?.length ?? 0,
            icon: <CheckmarkCircleRegular />,
            note: "History preserved",
            color: "purple",
          },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Patients needing attention</h2>
              <p>Follow-up priorities, based on estimated supply</p>
            </div>
            <Link to="/app/refills">View queue →</Link>
          </div>
          <DataTable
            rows={attention.slice(0, 5)}
            columns={[
              {
                key: "full_name",
                label: "Patient",
                render: (r) => (
                  <Link
                    className="patient-link"
                    to={`/app/patients/${r.patient_id}`}
                  >
                    <span className="avatar">
                      {String(r.full_name).slice(0, 1)}
                    </span>
                    <strong>{String(r.full_name)}</strong>
                  </Link>
                ),
              },
              { key: "medicine_name", label: "Medication" },
              { key: "last_covered_on", label: "Last covered" },
              {
                key: "status",
                label: "Status",
                render: (r) => <Status value={r.status} />,
              },
            ]}
          />
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>The week ahead</h2>
              <p>Scheduled contact targets</p>
            </div>
            <span className="chart-key">● Refills</span>
          </div>
          <div
            className="chart"
            aria-label="Contact targets for the next seven days"
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart}>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  width={25}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="#149b89"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-note">
            Refill timing is an estimate, not proof of medicine use.
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Recently registered</h2>
            <p>Keep the next step in their care moving</p>
          </div>
          <Link to="/app/patients">All patients →</Link>
        </div>
        <div className="recent-grid">
          {active.slice(-4).map((p) => (
            <Link
              className="recent-patient"
              key={p.id}
              to={`/app/patients/${p.id}`}
            >
              <span className="avatar">{String(p.full_name).slice(0, 1)}</span>
              <span>
                <strong>{String(p.full_name)}</strong>
                <small>
                  {String(p.conditions || "No conditions recorded")}
                </small>
              </span>
              <ArrowRightRegular />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
