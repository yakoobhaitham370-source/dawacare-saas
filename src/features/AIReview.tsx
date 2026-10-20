import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Field, Textarea, Checkbox } from "@fluentui/react-components";
import { useAuth } from "../app/context";
import { supabase } from "../lib/data";
import { clinical, phone } from "../lib/domain";
import { extractionSchema } from "../services/extraction";
import type { Extraction } from "../services/extraction";
import { Heading, Notice, DynamicFields } from "../components/common";
import { PatientSelect } from "./Patients";
export function AIReview() {
  const { scope } = useAuth();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [text, setText] = useState(""),
    [image, setImage] = useState<string>(),
    [consent, setConsent] = useState(false),
    [verified, setVerified] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [candidate, setCandidate] = useState<Extraction>(),
    [job, setJob] = useState(""),
    [match, setMatch] = useState("");
  async function extract() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setCandidate(undefined);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pharmacy_id: scope.tenant,
          text,
          image,
          consent,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error || "Extraction service unavailable. Use manual entry.",
        );
      }
      const result = await response.json();
      setCandidate(extractionSchema.parse(result.result));
      setJob(result.job_id);
      setVerified(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="AI-assisted entry"
        subtitle="Source → structured candidate → pharmacist review → verified records"
      />
      {scope.sandbox && (
        <Notice>
          External AI extraction is unavailable in the synthetic sandbox. No
          text or image is sent. Use manual patient entry to test workflows.
        </Notice>
      )}
      <div className="detail-grid">
        <section className="panel">
          <Field label="Source text (not retained by DawaCare)">
            <Textarea
              rows={8}
              value={text}
              onChange={(_, d) => setText(d.value)}
              placeholder="Paste Arabic or English information…"
            />
          </Field>
          <Field label="Prescription image (JPEG or PNG, max 2.8 MB)">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) {
                  setImage(undefined);
                  return;
                }
                if (
                  f.size > 2800000 ||
                  !["image/jpeg", "image/png"].includes(f.type)
                ) {
                  setError("Choose a JPEG or PNG no larger than 2.8 MB.");
                  e.target.value = "";
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setImage(String(reader.result));
                reader.readAsDataURL(f);
              }}
            />
          </Field>
          {image && (
            <img
              className="source-image"
              src={image}
              alt="Source prescription for pharmacist review"
            />
          )}
          <Checkbox
            checked={consent}
            onChange={(_, d) => setConsent(d.checked === true)}
            label="I have appropriate consent and authorization to send this information to the configured external AI provider."
          />
          <div className="form-actions">
            <Button
              onClick={() => {
                setText("");
                setImage(undefined);
                setCandidate(undefined);
              }}
            >
              Clear
            </Button>
            <Button
              appearance="primary"
              disabled={
                scope.sandbox ||
                !clinical(scope.role) ||
                !supabase ||
                !consent ||
                busy ||
                (!text.trim() && !image)
              }
              onClick={() => void extract()}
            >
              {scope.sandbox
                ? "Extract — provider not configured"
                : busy
                  ? "Extracting…"
                  : "Extract for review"}
            </Button>
          </div>
          <small>
            Requests consume the pharmacy allowance, including failures. No
            automatic retries. PDF extraction is not supported.
          </small>
        </section>
        <section className="panel">
          <h2>Pharmacist review</h2>
          {!candidate ? (
            <p>
              Extraction candidates will appear here. No patient or medication
              is saved by extraction.
            </p>
          ) : (
            <>
              <Notice>
                Missing information and low-confidence fields require manual
                review. Saving creates treatment records only; dispensing
                requires a separate confirmed event.
              </Notice>
              {candidate.warnings.map((w, i) => (
                <Notice key={i}>{w}</Notice>
              ))}
              <Field label="Match an existing patient (optional)">
                <PatientSelect value={match} onChange={setMatch} />
              </Field>
              {!match && (
                <DynamicFields
                  fields={[
                    {
                      key: "full_name",
                      label: "Confirmed full name",
                      required: true,
                    },
                    {
                      key: "phone",
                      label: "Confirmed Iraqi phone",
                      required: true,
                    },
                    {
                      key: "conditions",
                      label: "Conditions",
                      type: "textarea",
                    },
                  ]}
                  values={candidate.patient}
                  onChange={(k, v) =>
                    setCandidate({
                      ...candidate,
                      patient: { ...candidate.patient, [k]: v },
                    })
                  }
                />
              )}{" "}
              {candidate.medications.map((m, i) => (
                <div className="medication-review" key={i}>
                  <h3>
                    Medication {i + 1} · {Math.round(m.confidence * 100)}% model
                    confidence
                  </h3>
                  <p>{m.original_text}</p>
                  {m.warnings.map((w, n) => (
                    <Notice key={n}>{w}</Notice>
                  ))}
                  <DynamicFields
                    fields={[
                      {
                        key: "medicine_name",
                        label: "Medicine name",
                        required: true,
                      },
                      { key: "strength", label: "Strength", required: true },
                      { key: "form", label: "Form", required: true },
                      { key: "route", label: "Route", required: true },
                      {
                        key: "instructions",
                        label: "Verified instructions",
                        type: "textarea",
                        required: true,
                      },
                    ]}
                    values={m}
                    onChange={(k, v) =>
                      setCandidate({
                        ...candidate,
                        medications: candidate.medications.map((x, n) =>
                          n === i ? { ...x, [k]: v } : x,
                        ),
                      })
                    }
                  />
                  <Button
                    onClick={() =>
                      setCandidate({
                        ...candidate,
                        medications: candidate.medications.filter(
                          (_, n) => n !== i,
                        ),
                      })
                    }
                  >
                    Remove candidate
                  </Button>
                </div>
              ))}
              <Button
                onClick={() =>
                  setCandidate({
                    ...candidate,
                    medications: [
                      ...candidate.medications,
                      {
                        original_text: "Manual addition",
                        medicine_name: null,
                        strength: null,
                        form: null,
                        route: null,
                        instructions: null,
                        quantity: null,
                        days_supply: null,
                        warnings: ["Manually verify all fields"],
                        confidence: 0,
                      },
                    ],
                  })
                }
              >
                Add missing medication
              </Button>
              <Checkbox
                checked={verified}
                onChange={(_, d) => setVerified(d.checked === true)}
                label="I am the reviewing pharmacist and have verified every patient and medication field against the source."
              />
              <Button
                appearance="primary"
                disabled={!verified || busy}
                onClick={async () => {
                  if (!supabase) return;
                  setBusy(true);
                  setError("");
                  try {
                    const reviewed = {
                      ...candidate,
                      patient: {
                        ...candidate.patient,
                        phone: match
                          ? candidate.patient.phone
                          : phone.parse(candidate.patient.phone),
                      },
                    };
                    const { data, error } = await supabase.rpc(
                      "commit_extraction",
                      {
                        p_pharmacy: scope.tenant,
                        p_job: job,
                        p_patient: match || null,
                        p_data: reviewed,
                        p_verified: verified,
                      },
                    );
                    if (error) throw error;
                    await cache.invalidateQueries({ queryKey: ["records"] });
                    navigate(`/app/patients/${data}`);
                  } catch {
                    setError(
                      "Unable to save. Confirm all required fields, your permissions, and the extraction status.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save verified treatment records
              </Button>
            </>
          )}
        </section>
      </div>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
