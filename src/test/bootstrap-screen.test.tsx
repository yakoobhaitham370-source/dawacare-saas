// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, it, expect, vi } from "vitest";
import { InvitationAcceptance } from "../features/InvitationAcceptance";
const mock = vi.hoisted(() => ({
  updateUser: vi.fn().mockResolvedValue({ error: null }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
}));
vi.mock("../app/context", () => ({
  useAuth: () => ({
    ready: true,
    user: "verified-bootstrap-user",
    scope: { sandbox: false },
    signout: vi.fn(),
  }),
}));
vi.mock("../lib/data", () => ({
  supabase: { rpc: mock.rpc, auth: { updateUser: mock.updateUser } },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("lets a verified bootstrap administrator set a password without a pharmacy invitation", async () => {
  // JSDOM has no layout observer; browser layout is covered by Playwright.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <InvitationAcceptance />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText(/No pending invitation/);
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(/Set or update password/),
    "Synthetic-test-password!",
  );
  await user.click(
    screen.getByRole("button", { name: "Set account password" }),
  );
  await waitFor(() =>
    expect(mock.updateUser).toHaveBeenCalledWith({
      password: "Synthetic-test-password!",
    }),
  );
  expect(await screen.findByText(/Account password updated/)).toBeTruthy();
  expect(mock.rpc).not.toHaveBeenCalledWith(
    "accept_pharmacy_invitation",
    expect.anything(),
  );
});
