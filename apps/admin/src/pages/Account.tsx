import {
  EmailSection,
  LanguagePreference,
  Page,
  PasswordForm,
  ProfileForm,
  SessionList,
  ThemePreference,
} from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

/**
 * The operator's own login.
 *
 * The console had none, and the product's page is out of reach: a platform
 * admin who is not impersonating is bounced from `app.` back here. So an
 * operator could not change their own password or address, and could not see
 * their own sessions — the one list that shows the support sessions they take
 * into customers' workspaces, and the one place to end a device they no longer
 * hold.
 *
 * No "Close account": `close_account` refuses a platform_admin, so a button
 * here would exist only to answer 403.
 */
export function AccountPage() {
  const { me, refreshMe } = useSession();

  return (
    <Page title="Account" description="This operator's login. Theme is this browser only.">
      <div className="grid max-w-md gap-10">
        <ProfileForm api={api} me={me} onSaved={async () => void (await refreshMe())} />

        <EmailSection api={api} email={me?.user.email ?? ""} />

        <div className="grid gap-2 border-t pt-8">
          <h2 className="text-sm font-medium">Language</h2>
          <LanguagePreference api={api} onSaved={async () => void (await refreshMe())} />
        </div>

        <div className="grid gap-2 border-t pt-8">
          <h2 className="text-sm font-medium">Appearance</h2>
          <ThemePreference />
        </div>

        <PasswordForm api={api} />

        <SessionList api={api} />
      </div>
    </Page>
  );
}
