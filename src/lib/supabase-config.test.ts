import { describe, it, expect } from "vitest";
import { publicSupabaseConfig } from "./supabase-config";
const token = (role: string) =>
  `${btoa("{}")}.${btoa(JSON.stringify({ role }))}.test-signature`;
describe("frontend Supabase configuration", () => {
  it("keeps an unconfigured sandbox independent", () =>
    expect(publicSupabaseConfig({})).toBeNull());
  it("accepts a public publishable key over HTTPS", () =>
    expect(
      publicSupabaseConfig({
        url: "https://development.supabase.co",
        publishableKey: "sb_publishable_public-example",
      }),
    ).toEqual({
      url: "https://development.supabase.co",
      key: "sb_publishable_public-example",
    }));
  it("supports the legacy public anon key and local development", () =>
    expect(
      publicSupabaseConfig({
        url: "http://127.0.0.1:54321",
        anonKey: token("anon"),
      }),
    ).not.toBeNull());
  it.each([
    "sb_secret_do-not-use-in-a-browser",
    token("service_role"),
    "invalid",
  ])("rejects private or malformed keys without echoing their value", (key) => {
    try {
      publicSupabaseConfig({
        url: "https://development.supabase.co",
        anonKey: key,
      });
      throw new Error("Expected rejection");
    } catch (error) {
      expect(String(error)).not.toContain(key);
      expect(String(error)).toContain("public");
    }
  });
  it("rejects partial configuration and conflicting public keys", () => {
    expect(() =>
      publicSupabaseConfig({ url: "https://development.supabase.co" }),
    ).toThrow(/together/);
    expect(() =>
      publicSupabaseConfig({
        url: "https://development.supabase.co",
        anonKey: token("anon"),
        publishableKey: "sb_publishable_another-public-example",
      }),
    ).toThrow(/conflicting/);
  });
  it("rejects insecure remote URLs and embedded credentials", () => {
    for (const url of [
      "http://development.supabase.co",
      "https://name:password@development.supabase.co",
      "https://development.supabase.co/api",
    ])
      expect(() =>
        publicSupabaseConfig({
          url,
          publishableKey: "sb_publishable_public-example",
        }),
      ).toThrow();
  });
});
