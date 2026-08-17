import { useRef, useState } from "react";
import { toast } from "sonner";
import { errMsg } from "@hull/api-client";
import { AuthScreen, Button, Input, Label, useBrand } from "@hull/ui";
import { api } from "../lib/api";

/**
 * Land from the emailed reset link.
 *
 * The token arrives in the fragment, like the support hand-off: fragments are
 * never sent to a server, so it stays out of access logs and out of the Referer
 * of anything this page links to. It is read once, at module scope of this
 * render, and stripped from the address bar before the form is drawn.
 */
export function ResetPage() {
  const { brand, mark } = useBrand();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Read and strip on the first render, not in an effect: an effect runs after
  // paint, which leaves the token in the address bar long enough to be captured
  // by a screenshot or a bookmark.
  const token = useRef<string | null>(null);
  if (token.current === null) {
    token.current = decodeURIComponent(window.location.hash.slice(1));
    window.history.replaceState(null, "", "/reset");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      // Inline next to the form, not a toast — this is field validation.
      setError("Those two passwords are different.");
      return;
    }
    setPending(true);
    try {
      await api.resetPassword({ token: token.current ?? "", password });
      // Every session died with the reset, so there is nowhere to land but the
      // door. The destination plus the toast is the confirmation.
      toast.success("Password changed");
      window.location.replace("/signin");
    } catch (err) {
      setError(errMsg(err));
      setPending(false);
    }
  }

  if (!token.current) {
    return (
      <AuthScreen
        brand={brand}
        mark={mark}
        title="That link is incomplete"
        description="Reset links carry a token. Ask for a new one."
      >
        <Button type="button" className="w-fit" onClick={() => window.location.replace("/forgot")}>
          Send a new link
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      brand={brand}
      mark={mark}
      title="Choose a new password"
      description="At least 8 characters. This ends every signed-in session."
    >
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            data-testid="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm">Repeat it</Label>
          <Input
            id="confirm"
            data-testid="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" data-testid="reset-submit" disabled={pending}>
          {pending ? "Saving…" : "Set the password"}
        </Button>
      </form>
    </AuthScreen>
  );
}
