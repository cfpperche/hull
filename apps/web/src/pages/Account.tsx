import { useState } from "react";
import { errMsg } from "@hull/api-client";
import {
  Button,
  ConfirmDialog,
  EmailSection,
  Input,
  Label,
  Page,
  PasswordForm,
  ProfileForm,
  SessionList,
  ThemePreference,
} from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function AccountPage() {
  const { me, refreshMe, signOut, bumpAvatar } = useSession();
  const [closePw, setClosePw] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  async function closeAccount() {
    setCloseError(null);
    setClosing(true);
    try {
      await api.closeAccount({ password: closePw });
      setConfirmClose(false);
      await signOut();
    } catch (err) {
      setConfirmClose(false);
      setCloseError(errMsg(err));
    } finally {
      setClosing(false);
    }
  }

  return (
    <Page title="Account" description="This login. Theme is this browser only.">
      <div className="grid max-w-md gap-10">
        {/* bumpAvatar as well as refreshMe: the rail's <img> is keyed on that
            counter, so without it the chrome keeps the old photo while the
            toast says otherwise. */}
        <ProfileForm
          api={api}
          me={me}
          onSaved={async () => {
            await refreshMe();
            bumpAvatar();
          }}
        />

        <EmailSection api={api} email={me?.user.email ?? ""} />

        <div className="grid gap-2 border-t pt-8">
          <h2 className="text-sm font-medium">Appearance</h2>
          <ThemePreference />
        </div>

        <PasswordForm api={api} />

        <SessionList api={api} />

        {/* Only here, never on the console: close_account refuses a
            platform_admin, so the operator's page would offer a button that
            answers 403. */}
        <form
          className="grid gap-4 border-t pt-8"
          onSubmit={(e) => {
            e.preventDefault();
            setCloseError(null);
            setConfirmClose(true);
          }}
        >
          <h2 className="text-sm font-medium">Close account</h2>
          <p className="text-muted-foreground text-sm">Deletes this login and workspaces only you own.</p>
          <div className="grid gap-1.5">
            <Label htmlFor="close-password">Password</Label>
            <Input
              id="close-password"
              type="password"
              data-testid="close-password"
              value={closePw}
              onChange={(e) => setClosePw(e.target.value)}
            />
          </div>
          {closeError ? <p className="text-destructive text-sm">{closeError}</p> : null}
          <Button
            type="submit"
            variant="destructive"
            className="w-fit"
            data-testid="close-account"
            disabled={closing || !closePw}
          >
            Close account
          </Button>
        </form>
      </div>

      {/* AGENTS.md: destructive / irreversible takes a dialog before, not after. */}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        data-testid="close-account-dialog"
        title="Close this account?"
        description={
          <>
            This deletes <span className="text-foreground font-medium">{me?.user.email}</span> and every workspace you
            are the only owner of. Workspaces with other members are kept. It cannot be undone.
          </>
        }
        confirmLabel="Close account"
        pendingLabel="Closing…"
        pending={closing}
        onConfirm={() => void closeAccount()}
      />
    </Page>
  );
}
