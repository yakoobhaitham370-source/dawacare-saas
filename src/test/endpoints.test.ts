import { describe, it, expect, vi, afterEach } from "vitest";
import invite from "../../netlify/functions/invite";
import extract from "../../netlify/functions/extract";
import documents, { validSignature } from "../../netlify/functions/documents";
afterEach(() => vi.unstubAllEnvs());
describe("server endpoint guards without service credentials", () => {
  it.each([invite, extract, documents])(
    "rejects unsupported methods",
    async (handler) =>
      expect(
        (await handler(new Request("https://example.test/api"))).status,
      ).toBe(405),
  );
  it.each([invite, extract, documents])(
    "rejects cross-origin privileged requests",
    async (handler) => {
      vi.stubEnv("SITE_URL", "https://example.test");
      expect(
        (
          await handler(
            new Request("https://example.test/api", {
              method: "POST",
              headers: { Origin: "https://evil.test" },
            }),
          )
        ).status,
      ).toBe(403);
    },
  );
  it.each([invite, extract, documents])(
    "reports missing service configuration safely",
    async (handler) => {
      vi.stubEnv("SITE_URL", "https://example.test");
      vi.stubEnv("SUPABASE_URL", "");
      expect(
        (
          await handler(
            new Request("https://example.test/api", {
              method: "POST",
              headers: { Origin: "https://example.test" },
            }),
          )
        ).status,
      ).toBe(503);
    },
  );
  it("checks file magic instead of trusting an extension or MIME claim", () => {
    expect(
      validSignature(
        new TextEncoder().encode("<script>bad</script>"),
        "image/png",
      ),
    ).toBe(false);
    expect(
      validSignature(new TextEncoder().encode("%PDF-1.7"), "application/pdf"),
    ).toBe(true);
    expect(
      validSignature(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png",
      ),
    ).toBe(true);
    expect(validSignature(new Uint8Array([255, 216, 255]), "image/jpeg")).toBe(
      true,
    );
  });
});
