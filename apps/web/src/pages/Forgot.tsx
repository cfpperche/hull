import { useState } from "react";
import { Link } from "react-router";
import { errMsg } from "@hull/api-client";
import { AuthScreen, Button, Input, Label, useBrand } from "@hull/ui";
import { api } from "../lib/api";

/**
 * Ask for a reset link.
 *
 * The confirmation is this page changing into the "check your inbox" panel — a
 * write that leaves the form sitting there unchanged is the empty click
 * harness/action-feedback.md refuses.
 */
export function ForgotPage() {
  const { brand, mark } = useBrand();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api.forgotPassword({ email: email.trim() });
      // Deliberately the same panel whether or not that address has an account.
      // Saying "no such user" here would undo the server's refusal to say it.
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <AuthScreen
        brand={brand}
        mark={mark}
        title="Check your email"
        description="If that address has an account, a reset link is on its way."
        footer={
          <Link to="/signin" className="text-foreground underline" data-testid="forgot-to-signin">
            Back to sign in
          </Link>
        }
      >
        <p className="text-muted-foreground text-sm" data-testid="forgot-sent">
          The link works once and expires in 30 minutes. Nothing has changed until you use it.
        </p>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      brand={brand}
      mark={mark}
      title="Reset your password"
      description="We'll email you a link."
      footer={
        <Link to="/signin" className="text-foreground underline" data-testid="forgot-to-signin">
          Back to sign in
        </Link>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            data-testid="forgot-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" data-testid="forgot-submit" disabled={pending}>
          {pending ? "Sending…" : "Send the link"}
        </Button>
      </form>
    </AuthScreen>
  );
}
