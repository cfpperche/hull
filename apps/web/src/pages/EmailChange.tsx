import { useEffect, useRef, useState } from "react";
import { errMsg } from "@hull/api-client";
import { AuthScreen, Button, useBrand } from "@hull/ui";
import { api } from "../lib/api";

/**
 * Land from the link mailed to the *new* address.
 *
 * Public, and necessarily so: this link is opened from the mailbox being moved
 * to, which is the one place guaranteed not to hold a session for this install.
 * The password was confirmed back on the account page; this only proves someone
 * reads the new address.
 */
export function EmailChangePage() {
  const { brand, mark } = useBrand();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Read and strip during the first render, not in an effect — an effect runs
  // after paint, so the token would sit in the address bar for a frame. Reset
  // and Verify do the same; the three must not disagree about it.
  const token = useRef<string | null>(null);
  if (token.current === null) {
    token.current = decodeURIComponent(window.location.hash.slice(1));
    window.history.replaceState(null, "", "/email");
  }

  // The token is single use and StrictMode runs effects twice in dev, so without
  // this the second run spends a spent token and reports failure over a change
  // that worked.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token.current) {
      setError("This link has no token. Ask for a new one from your account.");
      return;
    }
    api
      .confirmEmailChange(token.current)
      .then(() => setDone(true))
      .catch((err) => setError(errMsg(err)));
  }, []);

  if (!error && !done) {
    return <div className="text-muted-foreground p-8 text-sm">Confirming…</div>;
  }

  if (done) {
    return (
      <AuthScreen
        brand={brand}
        mark={mark}
        title="Email changed"
        description="This is the address you sign in with now, and the one that resets your password."
      >
        {/* A full load, not a route change: the session in memory still holds
            the old address, and every other tab holds it too. */}
        <Button
          type="button"
          className="w-fit"
          data-testid="email-change-continue"
          onClick={() => window.location.replace("/")}
        >
          Continue
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      brand={brand}
      mark={mark}
      title="Could not change that address"
      description="These links are single use and expire after two hours. Changing your password cancels them."
    >
      <div className="grid gap-4">
        <p className="text-destructive text-sm" data-testid="email-change-error">
          {error}
        </p>
        <Button type="button" className="w-fit" onClick={() => window.location.replace("/")}>
          Go to sign in
        </Button>
      </div>
    </AuthScreen>
  );
}
