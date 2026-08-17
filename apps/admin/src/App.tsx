import { Building2, Database, HardDrive, LayoutDashboard, Mail, Users } from "lucide-react";
import { BrowserRouter, Route, Routes } from "react-router";
import { labOrigin, originFor } from "@hull/config";
import { ProductShell, useBrand } from "@hull/ui";
import { OperatorMenu } from "./components/OperatorMenu";
import { useSession } from "./lib/session";
import { AccountPage } from "./pages/Account";
import { NotFoundPage } from "./pages/NotFound";
import { OverviewPage } from "./pages/Overview";
import { OrgsPage } from "./pages/Orgs";
import { SigninPage } from "./pages/Signin";
import { UsersPage } from "./pages/Users";

export function App() {
  return (
    <BrowserRouter>
      <AdminApp />
    </BrowserRouter>
  );
}

function AdminApp() {
  const { brand, mark, host } = useBrand();
  const { ready, signedIn, me } = useSession();
  if (!ready) return <div className="text-muted-foreground p-8 text-sm">Loading…</div>;
  if (!signedIn) return <SigninPage />;
  if (me?.platform_role !== "platform_admin") {
    window.location.assign(originFor("web"));
    return <div className="text-muted-foreground p-8 text-sm">Redirecting…</div>;
  }
  return (
    <Routes>
      <Route
        element={
          <ProductShell
            brand={brand}
            mark={mark}
            brandHint="Admin"
            nav={[
              {
                items: [
                  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
                  { to: "/users", label: "Users", icon: Users },
                  { to: "/orgs", label: "Workspaces", icon: Building2 },
                ],
              },
              {
                // The services compose brings up next to the product. Hosts come
                // from /config.json, so a white-label apex follows without a
                // rebuild. Admin only — these are operator tools.
                label: "Lab",
                items: [
                  { to: labOrigin("mail", host), label: "Mail", icon: Mail, external: true },
                  { to: labOrigin("objects", host), label: "Objects", icon: HardDrive, external: true },
                  { to: labOrigin("db", host), label: "Database", icon: Database, external: true },
                ],
              },
            ]}
            footer={<OperatorMenu />}
          />
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/orgs" element={<OrgsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
