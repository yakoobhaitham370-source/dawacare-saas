import { useState } from "react";
import {
  Button,
  Input,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useRows, useSave } from "../lib/hooks";
import {
  DataTable,
  DynamicFields,
  Heading,
  LoadState,
  Notice,
} from "../components/common";
import type { FieldDef } from "../components/common";
import type { Row } from "../lib/domain";
export function Collection({
  table,
  title,
  fields,
  readonly = false,
  description,
  fixed = {},
}: {
  table: string;
  title: string;
  fields: FieldDef[];
  readonly?: boolean;
  description?: string;
  fixed?: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const query = useRows(table);
  const mutation = useSave(table);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null | undefined>();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const rows = (query.data ?? []).filter(
    (r) =>
      Object.entries(fixed).every(([k, v]) => r[k] === v) &&
      JSON.stringify(r)
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <Heading title={title} subtitle={description}>
        {!readonly && (
          <Button
            appearance="primary"
            onClick={() => {
              setValues({});
              setEditing(null);
              mutation.reset();
            }}
          >
            {t("add")}
          </Button>
        )}
      </Heading>
      <div className="panel">
        <div className="toolbar">
          <Input
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(_, d) => {
              setSearch(d.value);
              setPage(0);
            }}
          />
          <span className="muted">{rows.length} records</span>
        </div>
        <LoadState loading={query.isLoading} error={query.error} />
        <DataTable
          rows={rows.slice(page * 15, page * 15 + 15)}
          columns={fields
            .filter((f) => f.type !== "textarea")
            .slice(0, 6)
            .map((f) => ({ key: f.key, label: f.label }))}
          actions={
            readonly
              ? undefined
              : (r) => (
                  <Button
                    size="small"
                    onClick={() => {
                      setEditing(r);
                      setValues(r);
                      mutation.reset();
                    }}
                  >
                    Edit
                  </Button>
                )
          }
        />
        <div className="pagination">
          <Button disabled={!page} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            {page + 1} / {Math.max(1, Math.ceil(rows.length / 15))}
          </span>
          <Button
            disabled={(page + 1) * 15 >= rows.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(_, d) => {
          if (!d.open) setEditing(undefined);
        }}
      >
        <DialogSurface>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = Object.fromEntries(
                fields.map((f) => [
                  f.key,
                  values[f.key] ?? (f.type === "boolean" ? false : null),
                ]),
              );
              try {
                await mutation.mutateAsync({
                  data: { ...data, ...fixed },
                  id: editing?.id,
                });
                setEditing(undefined);
              } catch {
                /* mutation presents error */
              }
            }}
          >
            <DialogBody>
              <DialogTitle>{editing ? "Edit record" : t("add")}</DialogTitle>
              <DialogContent>
                <DynamicFields
                  fields={fields}
                  values={values}
                  onChange={(k, v) => setValues((x) => ({ ...x, [k]: v }))}
                />
                {mutation.error && (
                  <Notice error>{mutation.error.message}</Notice>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditing(undefined)}>
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  appearance="primary"
                  disabled={mutation.isPending}
                >
                  {t("save")}
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
    </>
  );
}
