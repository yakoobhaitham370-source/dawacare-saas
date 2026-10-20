import { describe, it, expect, vi, afterEach } from "vitest";
import { serverConfiguration } from "../../netlify/lib/config";
import health from "../../netlify/functions/health";
import {
  assertNoPrivateFrontendKeys,
  verifyDevelopmentFrontendTarget,
} from "../lib/supabase-config";
afterEach(() => vi.unstubAllEnvs());
describe("development configuration safeguards", () => {
  it("blocks secret values in any frontend variable, without echoing them", () => {
    for (const [name, value] of Object.entries({
      VITE_ANYTHING: "sb_secret_test-only",
      VITE_API: "sk-test-only",
      VITE_SERVICE_ROLE_KEY: "test-only",
    }))
      expect(() => assertNoPrivateFrontendKeys({ [name]: value })).toThrow(
        /Private credentials/,
      );
  });
  it("requires explicit development project identity for previews", () => {
    expect(() =>
      verifyDevelopmentFrontendTarget({
        CONTEXT: "deploy-preview",
        VITE_SUPABASE_URL: "https://production.supabase.co",
      }),
    ).toThrow(/separate development/);
    expect(() =>
      verifyDevelopmentFrontendTarget({
        CONTEXT: "deploy-preview",
        VITE_SUPABASE_URL: "https://development.supabase.co",
        VITE_DAWACARE_DEVELOPMENT_PROJECT_REF: "development",
      }),
    ).not.toThrow();
  });
  it("prevents a development function from redirecting to the production website", () => {
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
    vi.stubEnv("SITE_URL", "https://stunning-crumble-7aa0db.netlify.app");
    vi.stubEnv("DAWACARE_ENVIRONMENT", "development");
    expect(() => serverConfiguration()).toThrow(/separate development/);
  });
  it("rejects unauthenticated health requests before reading privileged settings", async () => {
    expect(
      (await health(new Request("https://example.test/api/health"))).status,
    ).toBe(401);
    expect(
      (
        await health(
          new Request("https://example.test/api/health", { method: "POST" }),
        )
      ).status,
    ).toBe(405);
  });
});
