import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
export function validSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (mime === "application/pdf")
    return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  return false;
}
export default async (req: Request) => {
  const reply = (status: number, body: unknown) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const site = process.env.SITE_URL;
  if (!site || req.headers.get("origin") !== new URL(site).origin)
    return reply(403, { error: "Forbidden" });
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return reply(503, { error: "Private document service is not configured" });
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return reply(401, { error: "Authentication required" });
  const server = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await server.auth.getUser(token);
  if (error || !data.user)
    return reply(401, { error: "Authentication required" });
  const scoped = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = z
        .object({ action: z.literal("download"), id: z.string().uuid() })
        .parse(await req.json());
      const { data: doc, error } = await scoped
        .from("patient_documents")
        .select("*")
        .eq("id", body.id)
        .is("archived_at", null)
        .single();
      if (error || !doc) return reply(404, { error: "Document unavailable" });
      const audit = await scoped.rpc("audit_document_access", {
        p_pharmacy: doc.pharmacy_id,
        p_id: doc.id,
      });
      if (audit.error) return reply(403, { error: "Forbidden" });
      const signed = await scoped.storage
        .from("patient-documents")
        .createSignedUrl(doc.object_path, 60, { download: true });
      if (signed.error) return reply(502, { error: "Unable to sign download" });
      return reply(200, { url: signed.data.signedUrl });
    }
    if (Number(req.headers.get("content-length") ?? 0) > 5500000)
      return reply(413, { error: "File too large" });
    const form = await req.formData();
    const pharmacy = z.string().uuid().parse(form.get("pharmacy_id")),
      patient = z.string().uuid().parse(form.get("patient_id")),
      category = z
        .enum(["prescription", "laboratory", "other"])
        .parse(form.get("category"));
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 5242880)
      return reply(400, { error: "Choose a file up to 5 MB" });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validSignature(bytes, file.type))
      return reply(400, {
        error: "File content does not match an allowed JPEG, PNG or PDF type",
      });
    const allowed = await scoped.rpc("can_write", { p_id: pharmacy });
    const p = await scoped
      .from("patients")
      .select("id")
      .eq("pharmacy_id", pharmacy)
      .eq("id", patient)
      .single();
    if (!allowed.data || p.error) return reply(403, { error: "Forbidden" });
    const path = `${pharmacy}/${crypto.randomUUID()}`;
    const uploaded = await server.storage
      .from("patient-documents")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) return reply(502, { error: "Private upload failed" });
    const registered = await scoped.rpc("register_document", {
      p_pharmacy: pharmacy,
      p_patient: patient,
      p_path: path,
      p_mime: file.type,
      p_size: file.size,
      p_category: category,
    });
    if (registered.error) {
      await server.storage.from("patient-documents").remove([path]);
      return reply(502, {
        error: "Document registration failed; upload cleanup requested",
      });
    }
    return reply(200, { id: registered.data });
  } catch {
    return reply(400, { error: "Invalid document request" });
  }
};
