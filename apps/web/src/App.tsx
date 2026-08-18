import { Home } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { originFor } from "@hull/config";
import { ProductShell, useBrand, useT } from "@hull/ui";
import { AvatarMenu } from "./components/AvatarMenu";
import { OrgSwitcher } from "./components/OrgSwitcher";
import { SupportBanner } from "./components/SupportBanner";
import { useSession } from "./lib/session";
import { AccountPage } from "./pages/Account";
import { CreateOrgPage } from "./pages/CreateOrg";
import { EmailChangePage } from "./pages/EmailChange";
import { ForgotPage } from "./pages/Forgot";
import { HandoffPage } from "./pages/Handoff";
import { ConfirmPage } from "./pages/Confirm";
import { HomePage } from "./pages/Home";
import { NotFoundPage } from "./pages/NotFound";
import { ResetPage } from "./pages/Reset";
import { SigninPage } from "./pages/Signin";
import { VerifyPage } from "./pages/Verify";
import { SignupPage } from "./pages/Signup";

export function App() {
  return (
    <BrowserRouter>
      <ClientApp />
    </BrowserRouter>
  );
}

function ClientApp() {
  const t = useT();
  const { brand, mark } = useBrand();
  const { ready, signedIn, me } = useSession();

  // Before every other guard. The hand-off arrives with no cookie for this host,
  // so `signedIn` is false and the signed-out catch-all would swallow /handoff
  // and render the sign-in page instead of redeeming the token.
  if (window.location.pathname === "/handoff") {
    return <HandoffPage />;
  }

  // Same reason, plus one of its own: the reset link may well be opened in the
  // browser the user is still signed in on, and the signed-in branch would send
  // it to Not found — losing the token in the fragment with it.
  if (window.location.pathname === "/reset") {
    return <ResetPage />;
  }

  // Same reasons again: the link is opened from a mail client, often on
  // another device, so it must not depend on a session either way.
  if (window.location.pathname === "/verify") {
    return <VerifyPage />;
  }

  // And again: this one lands in the new mailbox, which is the address least
  // likely to have a session here — the whole point is that it has to prove
  // itself before it becomes the login.
  if (window.location.pathname === "/email") {
    return <EmailChangePage />;
  }

  if (!ready) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        {t("app.loading")}
      </div>
    );
  }

  if (signedIn && me?.platform_role === "platform_admin" && !me.acting) {
    window.location.assign(originFor("admin"));
    return (
      <div className="text-muted-foreground p-8 text-sm">Redirecting…</div>
    );
  }

  if (!signedIn) {
    return (
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signin" element={<SigninPage />} />
        <Route path="/forgot" element={<ForgotPage />} />
        <Route path="*" element={<SigninPage />} />
      </Routes>
    );
  }

  // Before the first-run screen, not after it: nobody should be asked to name
  // themselves and their workspace and then be told they cannot come in.
  //
  // Not while impersonating. `me.user` is the operator during a support session,
  // their address was verified when they signed in, and the customer's state is
  // not the operator's to be stopped by — but the guard is written rather than
  // assumed, because the day an operator's own address lapses this is the line
  // that decides whether support still works.
  if (!me?.acting && !me?.user.email_verified) {
    return <ConfirmPage />;
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
            lead={
              acting ? (
                <ActingChip brand={brand} name={acting.name} />
              ) : (
                <OrgSwitcher />
              )
            }
            // Only impersonation reaches this slot now. The unverified banner
            // used to share it, and the wall above made it unreachable: nobody
            // who has not confirmed gets as far as the shell. A banner that can
            // never render is worse than no banner, so it went with the reason
            // for it.
            banner={acting ? <SupportBanner orgName={acting.name} /> : undefined}
            // Product surfaces only. Account is not one — it is reached from the
            // avatar menu at the foot of the rail, which is where Vercel, Linear
            // and Supabase all put it, and where a person already looks for
            // "things about me" because Sign out lives there too. Listing it
            // twice made the nav look like the product had two features.
            nav={[{ to: "/", label: t("home.title"), icon: Home, end: true }]}
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
