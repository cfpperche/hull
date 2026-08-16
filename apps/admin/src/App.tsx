import { Building2, LayoutDashboard, Users } from "lucide-react";
import { BrowserRouter, Route, Routes } from "react-router";
import { originFor } from "@hull/config";
import { Button, ProductShell, useBrand } from "@hull/ui";
import { useSession } from "./lib/session";
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
  const { brand, mark } = useBrand();
  const { ready, signedIn, me, signOut } = useSession();
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
              { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
              { to: "/users", label: "Users", icon: Users },
              { to: "/orgs", label: "Workspaces", icon: Building2 },
            ]}
            footer={
              <Button type="button" variant="ghost" className="w-full justify-start" data-testid="sign-out" onClick={() => void signOut()}>
                Sign out
              </Button>
            }
          />
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/orgs" element={<OrgsPage />} />
      </Route>
    </Routes>
  );
}
