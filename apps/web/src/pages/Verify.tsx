import { useEffect, useRef, useState } from "react";
import { AuthScreen, Button, useBrand, useT, useErrMsg } from "@hull/ui";
import { api } from "../lib/api";

/**
 * Land from the emailed confirmation link.
 *
 * Public, and it must stay that way: the link is opened from a mail client,
 * often on a different device from the one that signed up. Requiring a session
 * would strand exactly the person it is meant to confirm.
 */
export function VerifyPage() {
  const t = useT();
  const errMsg = useErrMsg();
  const { brand, mark } = useBrand();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Read and strip during the first render, not in the effect — an effect runs
  // after paint, so the token stays in the address bar across a frame, which is
  // long enough for a screenshot, a bookmark or a shoulder. Reset.tsx does the
  // same; these two pages must not disagree about it.
  const token = useRef<string | null>(null);
  if (token.current === null) {
    token.current = decodeURIComponent(window.location.hash.slice(1));
    window.history.replaceState(null, "", "/verify");
  }

  // Redemption is a side effect and belongs in one. StrictMode runs effects
  // twice in dev and the token is single use, so without this guard the second
  // run spends an already-spent token and reports failure over a verification
  // that worked.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token.current) {
      setError(t("verify.noToken"));
      return;
    }
    api
      .verifyEmail(token.current)
      .then(() => setDone(true))
      .catch((err) => setError(errMsg(err)));
  }, []);

  if (!error && !done) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        {t("verify.working")}
      </div>
    );
  }

  if (done) {
    return (
      <AuthScreen
        brand={brand}
        mark={mark}
        title={t("verify.doneTitle")}
        description={t("verify.doneDescription")}
      >
        <Button
          type="button"
          className="w-fit"
          data-testid="verify-continue"
          onClick={() => window.location.replace("/")}
        >
          {t("common.continue")}
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      brand={brand}
      mark={mark}
      title={t("verify.failedTitle")}
      description={t("verify.failedDescription")}
    >
      <div className="grid gap-4">
        <p className="text-destructive text-sm" data-testid="verify-error">
          {error}
        </p>
        <Button
          type="button"
          className="w-fit"
          onClick={() => window.location.replace("/")}
        >
          {t("auth.goToSignIn")}
        </Button>
      </div>
    </AuthScreen>
  );
}
