import { Home, UserRound } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { originFor } from "@hull/config";
import { ProductShell, useBrand } from "@hull/ui";
import { AvatarMenu } from "./components/AvatarMenu";
import { OrgSwitcher } from "./components/OrgSwitcher";
import { SupportBanner } from "./components/SupportBanner";
import { useSession } from "./lib/session";
import { AccountPage } from "./pages/Account";
import { CreateOrgPage } from "./pages/CreateOrg";
import { HandoffPage } from "./pages/Handoff";
import { HomePage } from "./pages/Home";
import { NotFoundPage } from "./pages/NotFound";
import { SigninPage } from "./pages/Signin";
import { SignupPage } from "./pages/Signup";

export function App() {
  return (
    <BrowserRouter>
      <ClientApp />
    </BrowserRouter>
  );
}

function ClientApp() {
  const { brand, mark } = useBrand();
  const { ready, signedIn, me } = useSession();

  // Before every other guard. The hand-off arrives with no cookie for this host,
  // so `signedIn` is false and the signed-out catch-all would swallow /handoff
  // and render the sign-in page instead of redeeming the token.
  if (window.location.pathname === "/handoff") {
    return <HandoffPage />;
  }

  if (!ready) {
    return <div className="text-muted-foreground p-8 text-sm">Loading…</div>;
  }

  if (signedIn && me?.platform_role === "platform_admin" && !me.acting) {
    window.location.assign(originFor("admin"));
    return <div className="text-muted-foreground p-8 text-sm">Redirecting…</div>;
  }

  if (!signedIn) {
    return (
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signin" element={<SigninPage />} />
        <Route path="*" element={<SigninPage />} />
      </Routes>
    );
  }

  if (!me?.org && !me?.acting) {
    return <CreateOrgPage />;
  }

  const acting = me.acting?.org;

  return (
    <Routes>
      <Route
        element={
          <ProductShell
            brand={brand}
            mark={mark}
            lead={acting ? <ActingChip brand={brand} name={acting.name} /> : <OrgSwitcher />}
            banner={acting ? <SupportBanner orgName={acting.name} /> : undefined}
            nav={[{ to: "/", label: "Home", icon: Home, end: true }, { to: "/account", label: "Account", icon: UserRound }]}
            footer={<AvatarMenu />}
          />
        }
      >
        <Route index element={<HomePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/signin" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function ActingChip({ brand, name }: { brand: string; name: string }) {
  return (
    <div className="px-1 py-1">
      <p className="text-sm font-semibold tracking-tight">{brand}</p>
      <p className="text-muted-foreground truncate text-xs">Viewing {name}</p>
    </div>
  );
}
