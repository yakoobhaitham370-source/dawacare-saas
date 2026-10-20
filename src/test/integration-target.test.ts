import { describe, it, expect } from "vitest";
import { integrationTarget } from "../../tests/integration/target";
const local = {
  DAWACARE_TEST_ENVIRONMENT: "development",
  DAWACARE_TEST_ALLOW_WRITES: "YES_SYNTHETIC_DEVELOPMENT",
  DAWACARE_TEST_SUPABASE_URL: "http://127.0.0.1:54321",
  DAWACARE_TEST_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public-example",
  DAWACARE_TEST_SUPABASE_SERVICE_ROLE_KEY: "test-only-not-a-real-key",
  DAWACARE_TEST_DATABASE_URL:
    "postgresql://postgres:local-example@127.0.0.1:54322/postgres",
};
describe("integration safety gates", () => {
  it("blocks implicit/unconfigured writes", () =>
    expect(() => integrationTarget({})).toThrow(/BLOCKED/));
  it("accepts an explicitly isolated local target", () =>
    expect(integrationTarget(local).local).toBe(true));
  it("rejects a local API paired with a remote database", () =>
    expect(() =>
      integrationTarget({
        ...local,
        DAWACARE_TEST_DATABASE_URL:
          "postgresql://example@remote.example/postgres",
      }),
    ).toThrow(/local database/));
  it("rejects the production Netlify origin even with a development write flag", () =>
    expect(() =>
      integrationTarget({
        ...local,
        DAWACARE_TEST_NETLIFY_URL:
          "https://stunning-crumble-7aa0db.netlify.app",
      }),
    ).toThrow(/production/));
  it("requires remote project identity, verified TLS and owned mailboxes", () => {
    const remote = {
      ...local,
      DAWACARE_TEST_SUPABASE_URL: "https://devref.supabase.co",
      DAWACARE_TEST_DATABASE_URL:
        "postgresql://example@db.devref.supabase.co/postgres?sslmode=verify-full",
      DAWACARE_TEST_PROJECT_REF: "devref",
      DAWACARE_TEST_EMAIL_DOMAIN: "controlled.example",
    };
    expect(integrationTarget(remote).local).toBe(false);
    expect(() =>
      integrationTarget({ ...remote, DAWACARE_TEST_PROJECT_REF: "other" }),
    ).toThrow(/project ref/);
    expect(() =>
      integrationTarget({
        ...remote,
        DAWACARE_TEST_DATABASE_URL:
          "postgresql://example@db.devref.supabase.co/postgres?sslmode=require",
      }),
    ).toThrow(/TLS/);
  });
});
