import { useState } from "react";
import { Button, Field, Select } from "@fluentui/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useRows } from "../lib/hooks";
import { supabase } from "../lib/data";
import { clinical } from "../lib/domain";
import { useAuth } from "../app/context";
import { Heading, DataTable, Notice } from "../components/common";
import { PatientSelect } from "./Patients";
export function PrivateDocuments({ patientId }: { patientId?: string }) {
  const { scope } = useAuth();
  const q = useRows("patient_documents");
  const cache = useQueryClient();
  const [patient, setPatient] = useState(patientId ?? ""),
    [category, setCategory] = useState("prescription"),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function authHeader() {
    const { data } = await supabase!.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token}` };
  }
  return (
    <>
      <Heading
        title="Private patient documents"
        subtitle="JPEG, PNG or PDF · Maximum 5 MB · Short-lived authorized downloads"
      />
      {scope.sandbox && (
        <Notice>
          File transfer is disabled in the synthetic sandbox. Hosted storage and
          signed access require Supabase and Netlify configuration and live
          authorization tests.
        </Notice>
      )}
      <section className="panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file || !supabase) return;
            setBusy(true);
            setError("");
            try {
              const form = new FormData();
              form.set("file", file);
              form.set("pharmacy_id", scope.tenant);
              form.set("patient_id", patient);
              form.set("category", category);
              const response = await fetch("/api/documents", {
                method: "POST",
                headers: await authHeader(),
                body: form,
              });
              if (!response.ok) {
                const b = await response.json();
                throw new Error(b.error || "Upload failed");
              }
              await cache.invalidateQueries({ queryKey: ["records"] });
              setFile(undefined);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Upload failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <Field label="Patient" required>
              <PatientSelect value={patient} onChange={setPatient} />
            </Field>
            <Field label="Category">
              <Select
                value={category}
                onChange={(_, d) => setCategory(d.value)}
              >
                {["prescription", "laboratory", "other"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Private document" required>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </Field>
          </div>
          <Button
            type="submit"
            appearance="primary"
            disabled={scope.sandbox || busy || !patient || !file}
          >
            Upload private document
          </Button>
        </form>
        {error && <Notice error>{error}</Notice>}
        <DataTable
          rows={(q.data ?? []).filter(
            (d) => !d.archived_at && (!patientId || d.patient_id === patientId),
          )}
          columns={[
            { key: "category", label: "Category" },
            { key: "mime_type", label: "Type" },
            { key: "size_bytes", label: "Bytes" },
            { key: "created_at", label: "Uploaded" },
          ]}
          actions={(r) => (
            <>
              <Button
                disabled={scope.sandbox || busy}
                onClick={async () => {
                  if (!supabase) return;
                  setError("");
                  try {
                    const response = await fetch("/api/documents", {
                      method: "POST",
                      headers: {
                        ...(await authHeader()),
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ action: "download", id: r.id }),
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error);
                    const link = document.createElement("a");
                    link.href = data.url;
                    link.rel = "noopener noreferrer";
                    link.target = "_blank";
                    link.click();
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Download failed",
                    );
                  }
                }}
              >
                Download (60-second link)
              </Button>
              {clinical(scope.role) && (
                <Button
                  disabled={scope.sandbox || busy}
                  onClick={async () => {
                    if (!supabase) return;
                    const { error } = await supabase.rpc("archive_document", {
                      p_pharmacy: scope.tenant,
                      p_id: r.id,
                    });
                    if (error) setError("Unable to archive document.");
                    else
                      await cache.invalidateQueries({ queryKey: ["records"] });
                  }}
                >
                  Archive
                </Button>
              )}
            </>
          )}
        />
      </section>
    </>
  );
}
