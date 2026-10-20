import { describe, it, expect, vi } from "vitest";
import {
  OpenAIExtractionProvider,
  extractionSchema,
  createProvider,
} from "./extraction";
describe("AI extraction contract (simulated provider responses)", () => {
  it("validates a bilingual multiple-medication candidate while preserving missing fields", () => {
    expect(
      extractionSchema.parse({
        patient: {
          full_name: "Ahmed أحمد",
          phone: null,
          age: 62,
          conditions: null,
        },
        medications: ["Metformin", "Amlodipine"].map((m) => ({
          original_text: m,
          medicine_name: m,
          strength: null,
          form: null,
          route: null,
          instructions: null,
          quantity: null,
          days_supply: null,
          warnings: ["Verify directions"],
          confidence: 0.5,
        })),
        warnings: [],
      }).medications,
    ).toHaveLength(2);
  });
  it("rejects invented invalid supply and malformed output", () => {
    expect(() =>
      extractionSchema.parse({ patient: { full_name: "X" }, medications: [] }),
    ).toThrow();
  });
  it("rejects provider failure without returning a review candidate", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new OpenAIExtractionProvider(
        "test-only",
        "test-model",
        transport,
      ).extract("untrusted source"),
    ).rejects.toThrow(/provider/);
    expect(transport).toHaveBeenCalledOnce();
  });
  it("rejects malformed provider JSON", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [{ finish_reason: "stop", message: { content: "not json" } }],
      }),
    );
    await expect(
      new OpenAIExtractionProvider(
        "test-only",
        "test-model",
        transport,
      ).extract("source"),
    ).rejects.toThrow();
  });
  it("keeps missing configuration unavailable", () =>
    expect(() => createProvider({})).toThrow(/not configured/));
});
