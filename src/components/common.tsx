import {
  Button,
  MessageBar,
  MessageBarBody,
  Spinner,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  Switch,
} from "@fluentui/react-components";
import type { Row } from "../lib/domain";
import { csv } from "../lib/domain";
import { useTranslation } from "react-i18next";
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <MessageBar intent={error ? "error" : "info"}>
      <MessageBarBody>{children}</MessageBarBody>
    </MessageBar>
  );
}
export function Status({ value }: { value: unknown }) {
  const v = String(value ?? "");
  return (
    <Badge
      appearance="tint"
      color={
        /overdue|suspended|expired|failed/.test(v)
          ? "danger"
          : /active|paid|completed|on_track/.test(v)
            ? "success"
            : "informative"
      }
    >
      {v.replaceAll("_", " ")}
    </Badge>
  );
}
export function LoadState({
  loading,
  error,
}: {
  loading: boolean;
  error: Error | null;
}) {
  const { t } = useTranslation();
  return loading ? (
    <Spinner label={t("loading")} />
  ) : error ? (
    <Notice error>{error.message}</Notice>
  ) : null;
}
export function Heading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export type FieldDef = {
  key: string;
  label: string;
  type?:
    "text" | "number" | "date" | "email" | "textarea" | "boolean" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
};
export function DynamicFields({
  fields,
  values,
  onChange,
}: {
  fields: FieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="form-grid">
      {fields.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          required={f.required}
          className={f.type === "textarea" ? "wide" : ""}
        >
          {f.type === "select" ? (
            <Select
              value={String(values[f.key] ?? "")}
              required={f.required}
              onChange={(_, d) => onChange(f.key, d.value)}
            >
              <option value="">Select…</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : f.type === "textarea" ? (
            <Textarea
              value={String(values[f.key] ?? "")}
              onChange={(_, d) => onChange(f.key, d.value)}
            />
          ) : f.type === "boolean" ? (
            <Switch
              checked={!!values[f.key]}
              onChange={(_, d) => onChange(f.key, d.checked)}
            />
          ) : (
            <Input
              type={f.type ?? "text"}
              min={f.min}
              required={f.required}
              value={String(values[f.key] ?? "")}
              onChange={(_, d) =>
                onChange(
                  f.key,
                  f.type === "number"
                    ? d.value === ""
                      ? ""
                      : Number(d.value)
                    : d.value,
                )
              }
            />
          )}
        </Field>
      ))}
    </div>
  );
}
export function DataTable({
  rows,
  columns,
  actions,
}: {
  rows: Row[];
  columns: {
    key: string;
    label: string;
    render?: (row: Row) => React.ReactNode;
  }[];
  actions?: (row: Row) => React.ReactNode;
}) {
  const { t } = useTranslation();
  if (!rows.length)
    return (
      <div className="empty">
        <span className="empty-symbol">✦</span>
        <h3>{t("empty")}</h3>
        <p>New records will appear here.</p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table role="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} role="row">
              {columns.map((c) => (
                <td key={c.key} role="cell">
                  <span className="mobile-cell-label" aria-hidden="true">
                    {c.label}
                  </span>
                  <div className="cell-content">
                    {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                  </div>
                </td>
              ))}
              {actions && (
                <td role="cell">
                  <span className="mobile-cell-label" aria-hidden="true">
                    Actions
                  </span>
                  <div className="row-actions">{actions(r)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Download({
  rows,
  filename,
}: {
  rows: Row[];
  filename: string;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      disabled={!rows.length || busy}
      onClick={async () => {
        setBusy(true);

        const url = URL.createObjectURL(
          new Blob([csv(rows)], { type: "text/csv;charset=utf-8;" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setBusy(false);
      }}
    >
      Export CSV
    </Button>
  );
}
import * as React from "react";
