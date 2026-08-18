import { useState } from "react";
import {
  Button,
  ConfirmDialog,
  EmailSection,
  Fill,
  Input,
  LanguagePreference,
  Label,
  Page,
  PasswordForm,
  ProfileForm,
  SessionList,
  ThemePreference,
  useT,
  useErrMsg,
} from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function AccountPage() {
  const t = useT();
  const errMsg = useErrMsg();
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
    <Page title={t("account.title")} description={t("account.description")}>
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

        {/* Above Appearance, and separated from it on purpose: the theme is
            this browser, the language is the account — it follows you to any
            browser, and it is what the mail is written in. */}
        <div className="grid gap-2 border-t pt-8">
          <h2 className="text-sm font-medium">{t("account.language.title")}</h2>
          <LanguagePreference
            api={api}
            onSaved={async () => void (await refreshMe())}
          />
        </div>

        <div className="grid gap-2 border-t pt-8">
          <h2 className="text-sm font-medium">
            {t("account.appearance.title")}
          </h2>
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
          <h2 className="text-sm font-medium">{t("account.close.title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("account.close.blurb")}
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="close-password">
              {t("account.close.password")}
            </Label>
            <Input
              id="close-password"
              type="password"
              data-testid="close-password"
              value={closePw}
              onChange={(e) => setClosePw(e.target.value)}
            />
          </div>
          {closeError ? (
            <p className="text-destructive text-sm">{closeError}</p>
          ) : null}
          <Button
            type="submit"
            variant="destructive"
            className="w-fit"
            data-testid="close-account"
            disabled={closing || !closePw}
          >
            {t("account.close.title")}
          </Button>
        </form>
      </div>

      {/* AGENTS.md: destructive / irreversible takes a dialog before, not after. */}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        data-testid="close-account-dialog"
        title={t("account.close.confirmTitle")}
        description={
          <Fill
            parts={t.parts("account.close.confirmBody")}
            nodes={{
              email: (
                <span className="text-foreground font-medium">
                  {me?.user.email}
                </span>
              ),
            }}
          />
        }
        confirmLabel={t("account.close.title")}
        pendingLabel={t("account.close.pending")}
        pending={closing}
        onConfirm={() => void closeAccount()}
      />
    </Page>
  );
}
