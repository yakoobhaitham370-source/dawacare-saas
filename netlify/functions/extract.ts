import { serverConfiguration } from "../lib/config";
import { createClient } from "@supabase/supabase-js";
import {
  createProvider,
  extractionRequest,
} from "../../src/services/extraction";
export default async (req: Request) => {
  const reply = (status: number, body: unknown) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  let site: URL;
  try {
    site = new URL(process.env.SITE_URL ?? "");
  } catch {
    return reply(503, { error: "Service configuration is incomplete" });
  }
  if (req.headers.get("origin") !== site.origin)
    return reply(403, { error: "Forbidden" });
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return reply(503, {
      error: "Extraction service is not configured. Use manual entry.",
    });
  let provider;
  try {
    provider = createProvider({
      provider: process.env.AI_PROVIDER,
      key: process.env.AI_API_KEY,
      model: process.env.AI_MODEL,
    });
  } catch {
    return reply(503, {
      error: "AI provider is not configured. Use manual entry.",
    });
  }
  try {
    serverConfiguration();
  } catch {
    return reply(503, {
      error: "Service is not configured for this development target",
    });
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return reply(401, { error: "Authentication required" });
  const server = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await server.auth.getUser(token);
  if (error || !data.user)
    return reply(401, { error: "Authentication required" });
  let input;
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 4100000)
      return reply(413, { error: "File too large" });
    const body = await req.text();
    if (body.length > 4100000) return reply(413, { error: "File too large" });
    input = extractionRequest.parse(JSON.parse(body));
  } catch {
    return reply(400, { error: "Invalid extraction input or missing consent" });
  }
  const scoped = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const reservation = await scoped.rpc("reserve_ai_request", {
    p_pharmacy: input.pharmacy_id,
    p_model: process.env.AI_MODEL,
  });
  if (reservation.error)
    return reply(403, {
      error:
        "Extraction not permitted. Check your role, subscription, or AI allowance.",
    });
  const job = reservation.data as string;
  try {
    const extracted = await provider.extract(input.text, input.image);
    const usage = await server.from("ai_usage_records").insert({
      pharmacy_id: input.pharmacy_id,
      job_id: job,
      input_tokens: extracted.inputTokens,
      output_tokens: extracted.outputTokens,
    });
    const complete = await server
      .from("ai_extraction_jobs")
      .update({ status: "completed" })
      .eq("id", job);
    if (usage.error || complete.error)
      throw new Error("Could not record extraction status");
    return reply(200, { job_id: job, result: extracted.result });
  } catch {
    await server
      .from("ai_extraction_jobs")
      .update({ status: "failed" })
      .eq("id", job);
    return reply(502, {
      error:
        "Extraction failed. No patient or medication record was saved. Use manual entry.",
    });
  }
};
