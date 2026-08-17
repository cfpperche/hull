import { useEffect, useRef, useState } from "react";
import { errMsg } from "@hull/api-client";
import { AuthScreen, Button, useBrand } from "@hull/ui";
import { api } from "../lib/api";

/**
 * Lands from the admin console's "View as".
 *
 * The session cookie is host-scoped, so admin.<host> cannot hand this surface a
 * session directly. It passes a one-time token in the URL fragment instead, and
 * this page exchanges it for a session that belongs to app.<host>.
 */
export function HandoffPage() {
  const { brand, mark } = useBrand();
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice in dev. The token is single-use, so without
  // this the second run would redeem an already-spent token and show an error
  // over a hand-off that actually worked.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "";
    // Strip it before doing anything else: a token left in the address bar ends
    // up in screenshots, bookmarks and shoulder-surfing range.
    window.history.replaceState(null, "", "/handoff");

    if (!token) {
      setError("This link has no hand-off token. Start again from the admin console.");
      return;
    }

    api
      .consumeHandoff(token)
      .then(() => window.location.replace("/"))
      .catch((err) => setError(errMsg(err)));
  }, []);

  if (!error) {
    return <div className="text-muted-foreground p-8 text-sm">Opening workspace…</div>;
  }

  return (
    <AuthScreen
      brand={brand}
      mark={mark}
      title="Could not open that workspace"
      description="Hand-off links are single use and expire after a minute."
    >
      <div className="grid gap-4">
        <p className="text-destructive text-sm">{error}</p>
        <Button type="button" className="w-fit" onClick={() => window.location.replace("/")}>
          Go to sign in
        </Button>
      </div>
    </AuthScreen>
  );
}
