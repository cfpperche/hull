import { useEffect, useRef, useState } from "react";
import { AuthScreen, Button, useBrand, useT, useErrMsg } from "@hull/ui";
import { api } from "../lib/api";

/**
 * Lands from the admin console's "View as".
 *
 * The session cookie is host-scoped, so admin.<host> cannot hand this surface a
 * session directly. It passes a one-time token in the URL fragment instead, and
 * this page exchanges it for a session that belongs to app.<host>.
 */
export function HandoffPage() {
  const t = useT();
  const errMsg = useErrMsg();
  const { brand, mark } = useBrand();
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice in dev. The token is single-use, so without
  // this the second run would redeem an already-spent token and show an error
  // over a hand-off that actually worked.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token =
      new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "";
    // Strip it before doing anything else: a token left in the address bar ends
    // up in screenshots, bookmarks and shoulder-surfing range.
    window.history.replaceState(null, "", "/handoff");

    if (!token) {
      setError(t("handoff.noToken"));
      return;
    }

    api
      .consumeHandoff(token)
      .then(() => window.location.replace("/"))
      .catch((err) => setError(errMsg(err)));
  }, []);

  if (!error) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        {t("handoff.working")}
      </div>
    );
  }

  return (
    <AuthScreen
      brand={brand}
      mark={mark}
      title={t("handoff.failedTitle")}
      description={t("handoff.failedDescription")}
    >
      <div className="grid gap-4">
        <p className="text-destructive text-sm">{error}</p>
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
