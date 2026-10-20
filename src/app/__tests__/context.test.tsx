// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { AuthProvider, useAuth } from "../context";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  getLevel: vi.fn(),
  signOut: vi.fn(),
  members: vi.fn(),
  admins: vi.fn(),
}));
vi.mock("../../lib/data", () => ({
  SANDBOX_TENANT: "synthetic-tenant",
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
      mfa: { getAuthenticatorAssuranceLevel: mocks.getLevel },
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_key: string, user: string) =>
          table === "platform_admins"
            ? mocks.admins(user)
            : { eq: () => mocks.members(user) },
      }),
    }),
  },
}));
let authEvent: (
  _event: string,
  session: { user: { id: string } } | null,
) => void;
function Probe() {
  const auth = useAuth();
  return (
    <>
      <output data-testid="access">
        {JSON.stringify({
          ready: auth.ready,
          user: auth.user,
          tenant: auth.scope.tenant,
          role: auth.scope.role,
          sandbox: auth.scope.sandbox,
          mfa: auth.mfa,
          error: auth.error,
        })}
      </output>
      <button onClick={() => void auth.signout()}>Sign out</button>
    </>
  );
}
const access = () => JSON.parse(screen.getByTestId("access").textContent!);
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return cache;
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  history.replaceState(null, "", "/app/dashboard");
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: "a" } } },
    error: null,
  });
  mocks.getLevel.mockResolvedValue({
    data: { currentLevel: "aal1" },
    error: null,
  });
  mocks.members.mockImplementation((user: string) =>
    Promise.resolve({
      data: [
        {
          pharmacy_id: `tenant-${user}`,
          role: "owner",
          pharmacies: { name: "Synthetic pharmacy" },
        },
      ],
      error: null,
    }),
  );
  mocks.admins.mockResolvedValue({ data: [], error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.onAuthStateChange.mockImplementation((callback: typeof authEvent) => {
    authEvent = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});
afterEach(() => cleanup());
describe("connected session and sandbox isolation", () => {
  it("ignores stale membership results after the authenticated user changes", async () => {
    let resolveA: (value: unknown) => void = () => {};
    mocks.members.mockImplementation((user: string) =>
      user === "a"
        ? new Promise((resolve) => {
            resolveA = resolve;
          })
        : Promise.resolve({
            data: [
              { pharmacy_id: "tenant-b", role: "technician", pharmacies: null },
            ],
            error: null,
          }),
    );
    const cache = mount();
    await waitFor(() => expect(mocks.members).toHaveBeenCalledWith("a"));
    cache.setQueryData(["records", "private-a"], "synthetic-sentinel");
    act(() => authEvent("SIGNED_IN", { user: { id: "b" } }));
    await waitFor(() => expect(access().tenant).toBe("tenant-b"));
    await act(async () =>
      resolveA({
        data: [{ pharmacy_id: "tenant-a", role: "owner" }],
        error: null,
      }),
    );
    expect(access()).toMatchObject({
      user: "b",
      tenant: "tenant-b",
      role: "technician",
    });
    expect(cache.getQueryData(["records", "private-a"])).toBeUndefined();
  });
  it("clears elevated access and cached records on session expiration", async () => {
    mocks.getLevel.mockResolvedValue({
      data: { currentLevel: "aal2" },
      error: null,
    });
    mocks.admins.mockResolvedValue({ data: [{ user_id: "a" }], error: null });
    const cache = mount();
    await waitFor(() => expect(access().role).toBe("super_admin"));
    cache.setQueryData(["records", "private"], "synthetic-sentinel");
    act(() => authEvent("SIGNED_OUT", null));
    await waitFor(() => expect(access().user).toBeNull());
    expect(access()).toMatchObject({
      tenant: "",
      role: "pharmacist",
      mfa: false,
    });
    expect(cache.getQueryData(["records", "private"])).toBeUndefined();
  });
  it("does not contact Supabase while the synthetic sandbox is active", async () => {
    sessionStorage.setItem("dawacare.sandbox", "true");
    sessionStorage.setItem("dawacare.sandbox.role", "technician");
    mount();
    expect(access()).toMatchObject({
      ready: true,
      user: null,
      tenant: "synthetic-tenant",
      role: "technician",
      sandbox: true,
    });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled();
  });
  it("exits a stored sandbox when opening an invitation or recovery route", async () => {
    sessionStorage.setItem("dawacare.sandbox", "true");
    sessionStorage.setItem("dawacare.sandbox.role", "super_admin");
    history.replaceState(null, "", "/accept-invitation");
    mount();
    await waitFor(() => expect(access().ready).toBe(true));
    expect(access()).toMatchObject({
      sandbox: false,
      user: "a",
      role: "owner",
    });
    expect(sessionStorage.getItem("dawacare.sandbox")).toBeNull();
  });
  it("fails closed when access verification fails", async () => {
    mocks.members.mockResolvedValue({
      data: null,
      error: new Error("simulated database failure"),
    });
    mount();
    await waitFor(() => expect(access().ready).toBe(true));
    expect(access()).toMatchObject({
      tenant: "",
      role: "pharmacist",
      mfa: false,
    });
    expect(access().error).toContain("Unable to verify");
  });
});
