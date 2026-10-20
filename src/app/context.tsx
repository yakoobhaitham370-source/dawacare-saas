import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, SANDBOX_TENANT } from "../lib/data";
import type { Scope } from "../lib/data";
import type { Role } from "../lib/domain";
export type Membership = {
  pharmacy_id: string;
  role: Role;
  pharmacies: { name: string } | null;
};
type Access = {
  ready: boolean;
  user: string | null;
  memberships: Membership[];
  tenant: string;
  role: Role;
  error: string;
  mfa: boolean;
};
const emptyAccess: Access = {
  ready: !supabase,
  user: null,
  memberships: [],
  tenant: "",
  role: "pharmacist",
  error: "",
  mfa: false,
};
type Auth = Omit<Access, "tenant" | "role"> & {
  scope: Scope;
  setTenant: (id: string) => void;
  enterSandbox: () => void;
  setDemoRole: (role: Role) => void;
  signout: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [sandbox, setSandbox] = useState(() => {
    if (
      ["/login", "/accept-invitation", "/reset-password", "/mfa"].includes(
        location.pathname,
      )
    ) {
      sessionStorage.removeItem("dawacare.sandbox");
      sessionStorage.removeItem("dawacare.sandbox.role");
      return false;
    }
    return sessionStorage.getItem("dawacare.sandbox") === "true";
  });
  const [demoRole, setDemoRole] = useState<Role>(
    (sessionStorage.getItem("dawacare.sandbox.role") as Role) || "owner",
  );
  const [access, setAccess] = useState<Access>(emptyAccess);
  useEffect(() => {
    if (!supabase || sandbox) return;
    let active = true,
      version = 0;
    let lastUser: string | null | undefined;
    async function load(id: string | null) {
      const request = ++version;
      if (!active) return;
      if (lastUser !== id) {
        cache.clear();
        lastUser = id;
      }
      setAccess({ ...emptyAccess, user: id, ready: false });
      if (!id) {
        setAccess({ ...emptyAccess, ready: true });
        return;
      }
      try {
        const [level, m, p] = await Promise.all([
          supabase!.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase!
            .from("pharmacy_memberships")
            .select("pharmacy_id,role,pharmacies(name)")
            .eq("user_id", id)
            .eq("active", true),
          supabase!.from("platform_admins").select("user_id").eq("user_id", id),
        ]);
        if (!active || version !== request) return;
        if (level.error || m.error || p.error)
          throw new Error("Access verification failed");
        const memberships = m.data as unknown as Membership[];
        setAccess({
          ready: true,
          user: id,
          memberships,
          tenant: memberships[0]?.pharmacy_id ?? "",
          role: p.data.length
            ? "super_admin"
            : (memberships[0]?.role ?? "pharmacist"),
          mfa: level.data.currentLevel === "aal2",
          error: "",
        });
      } catch {
        if (active && version === request)
          setAccess({
            ...emptyAccess,
            user: id,
            ready: true,
            error:
              "Unable to verify access. Check the development database configuration and try signing in again.",
          });
      }
    }
    // Auth callbacks must not await more SDK auth operations while its lock is held.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (active) void load(session?.user.id ?? null);
      }, 0);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active && version === 0) void load(data.session?.user.id ?? null);
      })
      .catch(() => {
        if (active)
          setAccess({
            ...emptyAccess,
            ready: true,
            error: "Unable to recover the session. Sign in again.",
          });
      });
    return () => {
      active = false;
      version++;
      data.subscription.unsubscribe();
    };
  }, [sandbox, cache]);
  return (
    <Context.Provider
      value={{
        ...access,
        ready: sandbox || access.ready,
        scope: {
          sandbox,
          tenant: sandbox ? SANDBOX_TENANT : access.tenant,
          role: sandbox ? demoRole : access.role,
        },
        setTenant: (id) => {
          const membership = access.memberships.find(
            (m) => m.pharmacy_id === id,
          );
          if (membership) {
            cache.clear();
            setAccess((a) => ({ ...a, tenant: id, role: membership.role }));
          }
        },
        enterSandbox: () => {
          cache.clear();
          sessionStorage.setItem("dawacare.sandbox", "true");
          sessionStorage.setItem("dawacare.sandbox.role", "owner");
          setDemoRole("owner");
          setSandbox(true);
        },
        setDemoRole: (r) => {
          if (sandbox) {
            setDemoRole(r);
            sessionStorage.setItem("dawacare.sandbox.role", r);
          }
        },
        signout: async () => {
          if (supabase && !sandbox) {
            const { error } = await supabase.auth.signOut({ scope: "local" });
            if (error) {
              setAccess((a) => ({
                ...a,
                error: "Sign out failed. Retry when connected.",
              }));
              throw new Error("Sign out failed");
            }
          }
          cache.clear();
          sessionStorage.removeItem("dawacare.sandbox");
          sessionStorage.removeItem("dawacare.sandbox.role");
          setAccess({ ...emptyAccess, ready: true });
          setSandbox(false);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("Auth provider missing");
  return value;
}
