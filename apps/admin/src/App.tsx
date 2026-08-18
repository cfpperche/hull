import {
  Building2,
  Database,
  HardDrive,
  LayoutDashboard,
  Mail,
  Users,
} from "lucide-react";
import { BrowserRouter, Route, Routes } from "react-router";
import { labOrigin, originFor } from "@hull/config";
import { ProductShell, useBrand, useT } from "@hull/ui";
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
  const t = useT();
  const { brand, mark, host } = useBrand();
  const { ready, signedIn, me } = useSession();
  if (!ready)
    return (
      <div className="text-muted-foreground p-8 text-sm">
        {t("app.loading")}
      </div>
    );
  if (!signedIn) return <SigninPage />;
  if (me?.platform_role !== "platform_admin") {
    window.location.assign(originFor("web"));
    return (
      <div className="text-muted-foreground p-8 text-sm">
        {t("admin.redirecting")}
      </div>
    );
  }
  return (
    <Routes>
      <Route
        element={
          <ProductShell
            brand={brand}
            mark={mark}
            brandHint={t("admin.title")}
            nav={[
              {
                items: [
                  {
                    to: "/",
                    label: t("admin.nav.overview"),
                    icon: LayoutDashboard,
                    end: true,
                  },
                  { to: "/users", label: t("admin.nav.users"), icon: Users },
                  { to: "/orgs", label: t("admin.nav.orgs"), icon: Building2 },
                ],
              },
              {
                // The services compose brings up next to the product. Hosts come
                // from /config.json, so a white-label apex follows without a
                // rebuild. Admin only — these are operator tools.
                label: t("admin.nav.lab"),
                items: [
                  {
                    to: labOrigin("mail", host),
                    label: t("admin.nav.mail"),
                    icon: Mail,
                    external: true,
                  },
                  {
                    to: labOrigin("objects", host),
                    label: t("admin.nav.objects"),
                    icon: HardDrive,
                    external: true,
                  },
                  {
                    to: labOrigin("db", host),
                    label: t("admin.nav.db"),
                    icon: Database,
                    external: true,
                  },
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
