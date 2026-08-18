import { useState } from "react";
import { toast } from "sonner";
import { AuthScreen, Button, Fill, useBrand, useErrMsg, useT } from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

/**
 * The wall. Nothing in the product is reachable until the address is confirmed.
 *
 * It stands before the first-run screen rather than after it, so nobody is asked
 * to name themselves and their workspace and *then* told they cannot come in.
 * The cheapest place to be stopped is the earliest one.
 *
 * Three ways out, and all three are deliberate. Ask for the link again, because
 * mail gets lost. Say you have used it, because this page cannot know without
 * being told — there is no push from the server and polling a page somebody may
 * leave open for a day is a worse trade than one button. And sign out, because
 * the alternative to a way out is a support ticket.
 *
 * A typo'd address is the case that decides the shape: `/v1/me/email` stays
 * open to an unverified session precisely so somebody who mistyped can move it,
 * and the account page is reachable from here for that reason.
 */
export function ConfirmPage() {
  const t = useT();
  const errMsg = useErrMsg();
  const { brand, mark } = useBrand();
  const { me, refreshMe, signOut } = useSession();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const email = me?.user.email ?? "";

  async function resend() {
    setSending(true);
    try {
      await api.resendVerification();
      toast.success(t("verify.resent"));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSending(false);
    }
  }

  async function recheck() {
    setChecking(true);
    try {
      const next = await refreshMe();
      // Still here means still unverified — the gate above this page would have
      // stopped rendering it otherwise. Saying so is the whole point: a button
      // that silently does nothing is the empty click action-feedback.md refuses.
      if (next && !next.user.email_verified) toast.error(t("verify.stillWaiting"));
    } finally {
      setChecking(false);
    }
  }

  return (
    <AuthScreen brand={brand} mark={mark} title={t("verify.wallTitle")}>
      <div className="grid gap-5">
        <p className="text-muted-foreground text-sm" data-testid="confirm-wall">
          <Fill
            parts={t.parts("verify.wallBody")}
            nodes={{
              email: <span className="text-foreground font-medium">{email}</span>,
            }}
          />
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            data-testid="confirm-recheck"
            disabled={checking}
            onClick={() => void recheck()}
          >
            {t("verify.recheck")}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="verify-resend"
            disabled={sending}
            onClick={() => void resend()}
          >
            {sending ? t("verify.resending") : t("verify.resend")}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{t("verify.wrongAddress")}</p>
        <button
          type="button"
          className="text-muted-foreground w-fit text-sm underline"
          data-testid="sign-out"
          onClick={() => void signOut()}
        >
          {t("auth.signOut")}
        </button>
      </div>
    </AuthScreen>
  );
}
