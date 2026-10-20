import { Component, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Button,
  Select,
} from "@fluentui/react-components";
import {
  NavigationRegular,
  GridRegular,
  PeopleRegular,
  PillRegular,
  CalendarClockRegular,
  ChatRegular,
  SparkleRegular,
  DocumentRegular,
  PeopleTeamRegular,
  ChartMultipleRegular,
  SettingsRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
  SignOutRegular,
  HeartPulseRegular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context";
import { Heading, LoadState, Notice } from "../components/common";
import { Dashboard } from "../features/Dashboard";
import {
  Patients,
  PatientForm,
  PatientDetail,
  Medications,
  Laboratory,
} from "../features/Patients";
import { Refills } from "../features/Refills";
import { Landing, Login, AcceptInvitation } from "../features/Auth";
import {
  AdminOverview,
  adminCollections,
  Subscription,
  Reports,
  Settings,
} from "../features/Other";
import { Collection } from "../features/Collection";
import {
  Pharmacies,
  StaffManagement,
  Payments,
} from "../features/Administration";
import { PrivateDocuments } from "../features/Documents";
import { AIReview } from "../features/AIReview";
import { MFA } from "../features/MFA";
import type { Role } from "../lib/domain";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: false },
  },
});
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="auth-page">
        <div className="panel">
          <h1>Something interrupted this workspace.</h1>
          <p>Reload to try again. Unsaved changes may need to be re-entered.</p>
          <Button onClick={() => location.reload()}>Reload application</Button>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}
const pharmacyNav = [
  ["dashboard", GridRegular],
  ["patients", PeopleRegular],
  ["medications", PillRegular],
  ["refills", CalendarClockRegular],
  ["follow-ups", ChatRegular],
  ["ai-entry", SparkleRegular],
  ["laboratory", HeartPulseRegular],
  ["documents", DocumentRegular],
  ["staff", PeopleTeamRegular],
  ["reports", ChartMultipleRegular],
  ["subscription", DocumentRegular],
  ["settings", SettingsRegular],
] as const;
const adminNav = [
  "dashboard",
  "pharmacies",
  "subscriptions",
  "plans",
  "invoices",
  "payments",
  "analytics",
  "audit-logs",
  "settings",
];
function Guard({ admin = false }: { admin?: boolean }) {
  const auth = useAuth();
  if (!auth.ready) return <LoadState loading error={null} />;
  if (!auth.scope.sandbox && !auth.user)
    return <Navigate to="/login" replace />;
  if (
    admin &&
    !auth.scope.sandbox &&
    auth.scope.role === "super_admin" &&
    !auth.mfa
  )
    return <Navigate to="/mfa" replace />;
  if (admin && auth.scope.role !== "super_admin")
    return <Navigate to="/app/dashboard" replace />;
  if (!admin && auth.scope.role === "super_admin")
    return <Navigate to="/admin/dashboard" replace />;
  if (!auth.scope.sandbox && !admin && !auth.scope.tenant)
    return (
      <div className="panel">
        <Notice error>
          {auth.error ||
            "No active pharmacy membership. Ask your pharmacy owner to check your invitation or account status."}
        </Notice>
        <Button onClick={() => void auth.signout()}>Sign out</Button>
      </div>
    );
  return <Outlet />;
}
function Shell({
  dark,
  toggleTheme,
}: {
  dark: boolean;
  toggleTheme: () => void;
}) {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const admin = auth.scope.role === "super_admin";
  const nav = admin
    ? adminNav.map((n) => [n, GridRegular] as const)
    : pharmacyNav;
  return (
    <div className="workspace">
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link
          className="brand"
          to={admin ? "/admin/dashboard" : "/app/dashboard"}
        >
          <img src="/icon.svg" alt="" />
          DawaCare
          <span className="brand-dot" />
        </Link>
        <div className="workspace-label">
          {admin ? "PLATFORM CONSOLE" : "PHARMACY WORKSPACE"}
        </div>
        <nav aria-label="Main navigation">
          {nav.map(([name, Icon]) => (
            <NavLink
              onClick={() => setOpen(false)}
              key={name}
              to={`${admin ? "/admin" : "/app"}/${name}`}
            >
              <Icon />
              <span>{t(name)}</span>
              {name === "ai-entry" && (
                <small aria-hidden="true" className="new-label">
                  AI
                </small>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-caption">
            <span className="status-dot" />
            <span>
              {auth.scope.sandbox
                ? "Development workspace"
                : "Connected workspace"}
            </span>
          </div>
          <small>DawaCare · Care beyond the counter</small>
        </div>
      </aside>
      {open && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              className="mobile-menu"
              icon={<NavigationRegular />}
              appearance="subtle"
              aria-label="Toggle navigation"
              onClick={() => setOpen(!open)}
            />
            <div className="pharmacy-mark">
              <HeartPulseRegular />
            </div>
            <div>
              <strong>
                {admin
                  ? "DawaCare administration"
                  : auth.scope.sandbox
                    ? "Al-Shifa Pharmacy"
                    : (auth.memberships.find(
                        (m) => m.pharmacy_id === auth.scope.tenant,
                      )?.pharmacies?.name ?? "Pharmacy workspace")}
              </strong>
              <small>
                {admin ? "SaaS owner workspace" : "Mosul, Iraq · Asia/Baghdad"}
              </small>
            </div>
          </div>
          <div className="header-actions">
            {auth.memberships.length > 1 && !auth.scope.sandbox && (
              <Select
                aria-label="Choose authorized pharmacy"
                value={auth.scope.tenant}
                onChange={(_, d) => {
                  queryClient.clear();
                  auth.setTenant(d.value);
                }}
              >
                {auth.memberships.map((m) => (
                  <option key={m.pharmacy_id} value={m.pharmacy_id}>
                    {m.pharmacies?.name}
                  </option>
                ))}
              </Select>
            )}
            <Button
              appearance="subtle"
              onClick={() => {
                const lang = i18n.language === "ar" ? "en" : "ar";
                void i18n.changeLanguage(lang);
                localStorage.setItem("dawacare.language", lang);
              }}
            >
              {i18n.language === "ar" ? "English" : "العربية"}
            </Button>
            <Button
              appearance="subtle"
              icon={dark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
              aria-label={dark ? t("light") : t("dark")}
              onClick={toggleTheme}
            />
            <Button
              appearance="subtle"
              icon={<SignOutRegular />}
              aria-label={t("logout")}
              onClick={async () => {
                await auth.signout();
                queryClient.clear();
                navigate("/");
              }}
            />
            <span className="user-avatar">{admin ? "SA" : "DC"}</span>
          </div>
        </header>
        {auth.scope.sandbox && (
          <div className="sandbox-bar">
            <span>{t("sandbox")}</span>
            <Select
              size="small"
              aria-label="Sandbox test role"
              value={auth.scope.role}
              onChange={(_, d) => {
                auth.setDemoRole(d.value as Role);
                queryClient.clear();
                navigate(
                  d.value === "super_admin"
                    ? "/admin/dashboard"
                    : "/app/dashboard",
                );
              }}
            >
              {["owner", "pharmacist", "technician", "super_admin"].map((r) => (
                <option key={r} value={r}>
                  Test role: {r}
                </option>
              ))}
            </Select>
          </div>
        )}
        <main id="main-content" className="main-content">
          <Outlet />
        </main>
        <footer className="footer">
          <span>Thoughtful care. Every day.</span>
          <span>DawaCare · Development build</span>
        </footer>
      </div>
    </div>
  );
}
function Routed({
  dark,
  toggleTheme,
}: {
  dark: boolean;
  toggleTheme: () => void;
}) {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {["features", "pricing", "contact"].map((s) => (
        <Route key={s} path={`/${s}`} element={<Landing section={s} />} />
      ))}
      <Route path="/mfa" element={<MFA />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<Login reset />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route element={<Guard />}>
        <Route element={<Shell dark={dark} toggleTheme={toggleTheme} />}>
          <Route path="/app/dashboard" element={<Dashboard />} />
          <Route path="/app/patients" element={<Patients />} />
          <Route path="/app/patients/new" element={<PatientForm />} />
          <Route path="/app/patients/:id" element={<PatientDetail />} />
          <Route path="/app/patients/:id/edit" element={<PatientForm />} />
          <Route path="/app/medications" element={<Medications />} />
          <Route path="/app/refills" element={<Refills />} />
          <Route path="/app/follow-ups" element={<Refills />} />
          <Route path="/app/ai-entry" element={<AIReview />} />
          <Route path="/app/laboratory" element={<Laboratory />} />
          <Route path="/app/documents" element={<PrivateDocuments />} />
          <Route path="/app/staff" element={<StaffManagement />} />
          <Route path="/app/reports" element={<Reports />} />
          <Route path="/app/subscription" element={<Subscription />} />
          <Route path="/app/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route element={<Guard admin />}>
        <Route element={<Shell dark={dark} toggleTheme={toggleTheme} />}>
          <Route path="/admin/dashboard" element={<AdminOverview />} />
          <Route path="/admin/analytics" element={<AdminOverview />} />
          {Object.entries(adminCollections).map(([path, props]) => (
            <Route
              key={path}
              path={`/admin/${path}`}
              element={
                path === "pharmacies" ? (
                  <Pharmacies />
                ) : path === "payments" ? (
                  <Payments />
                ) : (
                  <Collection title={path.replace("-", " ")} {...props} />
                )
              }
            />
          ))}
          <Route
            path="/admin/pharmacies/:id"
            element={
              <Notice>
                Pharmacy details and provisioning are pending the verified
                invitation service. Use the pharmacy directory for available
                metadata.
              </Notice>
            }
          />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <main className="auth-page">
            <div>
              <Heading title="Page not found" />
              <Link to="/">Return home</Link>
            </div>
          </main>
        }
      />
    </Routes>
  );
}
export default function App() {
  const { i18n } = useTranslation();
  const [dark, setDark] = useState(
    localStorage.getItem("dawacare.theme") === "dark",
  );
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";
  }, [i18n.language]);
  const toggle = () =>
    setDark((v) => {
      localStorage.setItem("dawacare.theme", v ? "light" : "dark");
      return !v;
    });
  return (
    <Boundary>
      <FluentProvider
        theme={{
          ...(dark ? webDarkTheme : webLightTheme),
          colorBrandBackground: "#087f72",
          colorBrandBackgroundHover: "#066b61",
          colorBrandBackgroundPressed: "#05574e",
          colorBrandForeground1: dark ? "#57d2bc" : "#087f72",
        }}
        dir={i18n.language === "ar" ? "rtl" : "ltr"}
        className={dark ? "theme-dark" : "theme-light"}
      >
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <Routed dark={dark} toggleTheme={toggle} />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </FluentProvider>
    </Boundary>
  );
}
