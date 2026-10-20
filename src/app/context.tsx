import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase, SANDBOX_TENANT } from "../lib/data";
import type { Scope } from "../lib/data";
import type { Role } from "../lib/domain";
export type Membership = {
  pharmacy_id: string;
  role: Role;
  pharmacies: { name: string } | null;
};
type Auth = {
  scope: Scope;
  ready: boolean;
  user: string | null;
  memberships: Membership[];
  setTenant: (id: string) => void;
  enterSandbox: () => void;
  setDemoRole: (role: Role) => void;
  signout: () => Promise<void>;
  error: string;
  mfa: boolean;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sandbox, setSandbox] = useState(
    sessionStorage.getItem("dawacare.sandbox") === "true",
  );
  const [mfa, setMfa] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [tenant, setTenant] = useState("");
  const [demoRole, setDemoRole] = useState<Role>(
    (sessionStorage.getItem("dawacare.sandbox.role") as Role) || "owner",
  );
  const [role, setRole] = useState<Role>("pharmacist");
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const load = async (id: string | null) => {
      if (!active) return;
      setUser(id);
      setMemberships([]);
      setTenant("");
      setRole("pharmacist");
      if (id) {
        const level = await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
        setMfa(level.data?.currentLevel === "aal2");
        const [m, p] = await Promise.all([
          supabase!
            .from("pharmacy_memberships")
            .select("pharmacy_id,role,pharmacies(name)")
            .eq("user_id", id)
            .eq("active", true),
          supabase!.from("platform_admins").select("user_id").eq("user_id", id),
        ]);
        if (!active) return;
        if (m.error || p.error)
          setError("Unable to verify access. Check database configuration.");
        else {
          const rows = m.data as unknown as Membership[];
          setMemberships(rows);
          if (p.data.length) setRole("super_admin");
          else if (rows.length) {
            setTenant(rows[0].pharmacy_id);
            setRole(rows[0].role);
          }
        }
      }
      if (active) setReady(true);
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => load(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void load(session?.user.id ?? null), 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        scope: {
          sandbox,
          tenant: sandbox ? SANDBOX_TENANT : tenant,
          role: sandbox ? demoRole : role,
        },
        ready,
        user,
        memberships,
        error,
        mfa,
        enterSandbox: () => {
          sessionStorage.setItem("dawacare.sandbox", "true");
          setSandbox(true);
          setDemoRole("owner");
          sessionStorage.setItem("dawacare.sandbox.role", "owner");
        },
        setTenant: (id) => {
          const m = memberships.find((x) => x.pharmacy_id === id);
          if (m) {
            setTenant(id);
            setRole(m.role);
          }
        },
        setDemoRole: (r) => {
          if (sandbox) {
            setDemoRole(r);
            sessionStorage.setItem("dawacare.sandbox.role", r);
          }
        },
        signout: async () => {
          if (supabase && !sandbox) await supabase.auth.signOut();
          sessionStorage.removeItem("dawacare.sandbox");
          sessionStorage.removeItem("dawacare.sandbox.role");
          setSandbox(false);
          setUser(null);
          setTenant("");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const c = useContext(Context);
  if (!c) throw new Error("Auth provider missing");
  return c;
}
