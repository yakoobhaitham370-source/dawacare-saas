import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import invite from "../../netlify/functions/invite";
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  claim: vi.fn(),
  serverRpc: vi.fn(),
  otp: vi.fn(),
  newUser: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options: { global?: unknown }) =>
    options.global
      ? { rpc: mock.claim }
      : {
          rpc: mock.serverRpc,
          auth: {
            getUser: mock.getUser,
            signInWithOtp: mock.otp,
            admin: { inviteUserByEmail: mock.newUser },
          },
        },
}));
const id = "81000000-0000-4000-8000-000000000001",
  lease = "81000000-0000-4000-8000-000000000002";
function request() {
  return new Request("https://development.example.test/api/invite", {
    method: "POST",
    headers: {
      Origin: "https://development.example.test",
      Authorization: "Bearer synthetic-user-jwt",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invitation_id: id }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SITE_URL", "https://development.example.test");
  vi.stubEnv("SUPABASE_URL", "https://development.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-server-key");
  vi.stubEnv("DAWACARE_ENVIRONMENT", "development");
  vi.stubEnv("DAWACARE_DEVELOPMENT_PROJECT_REF", "development");
  mock.getUser.mockResolvedValue({
    data: { user: { id: "requester" } },
    error: null,
  });
  mock.claim.mockResolvedValue({
    data: { id, lease, email: "synthetic@example.test" },
    error: null,
  });
  mock.serverRpc.mockImplementation((name: string) =>
    Promise.resolve({
      data: name === "invitation_recipient" ? null : true,
      error: null,
    }),
  );
  mock.newUser.mockResolvedValue({
    data: { user: { id: "new-recipient" } },
    error: null,
  });
  mock.otp.mockResolvedValue({ data: {}, error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("invitation delivery endpoint (mocked external Auth transport)", () => {
  it("creates an Auth invitation only after a JWT-scoped delivery lease", async () => {
    const response = await invite(request());
    expect(response.status).toBe(200);
    expect(mock.getUser).toHaveBeenCalledWith("synthetic-user-jwt");
    expect(mock.claim).toHaveBeenCalledWith("claim_invitation_delivery", {
      p_id: id,
    });
    expect(mock.newUser).toHaveBeenCalledWith("synthetic@example.test", {
      redirectTo: "https://development.example.test/accept-invitation",
    });
    expect(mock.serverRpc).toHaveBeenCalledWith("finish_invitation_delivery", {
      p_id: id,
      p_lease: lease,
      p_user: "new-recipient",
      p_success: true,
    });
  });
  it("sends existing accounts a login link with account creation disabled", async () => {
    mock.serverRpc.mockImplementation((name: string) =>
      Promise.resolve({
        data: name === "invitation_recipient" ? "existing-user" : true,
        error: null,
      }),
    );
    expect((await invite(request())).status).toBe(200);
    expect(mock.newUser).not.toHaveBeenCalled();
    expect(mock.otp).toHaveBeenCalledWith({
      email: "synthetic@example.test",
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "https://development.example.test/accept-invitation",
      },
    });
  });
  it("does not send email when JWT verification or authorization fails", async () => {
    mock.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Invalid JWT"),
    });
    expect((await invite(request())).status).toBe(401);
    expect(mock.claim).not.toHaveBeenCalled();
    expect(mock.newUser).not.toHaveBeenCalled();
  });
  it("does not send email when a lease is denied", async () => {
    mock.claim.mockResolvedValue({ data: null, error: new Error("Forbidden") });
    expect((await invite(request())).status).toBe(409);
    expect(mock.newUser).not.toHaveBeenCalled();
  });
  it("preserves retryability and safe responses after a provider failure", async () => {
    mock.newUser.mockRejectedValue(
      new Error("simulated provider failure with private details"),
    );
    const result = await invite(request());
    expect(result.status).toBe(502);
    expect(JSON.stringify(await result.json())).not.toContain(
      "private details",
    );
    expect(mock.serverRpc).toHaveBeenCalledWith("finish_invitation_delivery", {
      p_id: id,
      p_lease: lease,
      p_user: null,
      p_success: false,
    });
  });
});
