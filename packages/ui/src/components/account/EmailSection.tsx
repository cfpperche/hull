import { useState } from "react";
import type { HullApi } from "@hull/api-client";
import { errMsg } from "@hull/api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

/**
 * Move the address this login signs in with.
 *
 * Nothing on screen changes when the form is submitted, and that is the whole
 * design: the server has not moved anything either. The current address keeps
 * working until the new one redeems the link it was mailed.
 */
export function EmailSection({
  api,
  email,
}: {
  api: Pick<HullApi, "changeEmail">;
  email: string;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(null);
    setPending(true);
    try {
      const asked = newEmail.trim();
      await api.changeEmail({ password, email: asked });
      // Deliberately no refresh: the server changed nothing yet, and re-reading
      // the principal here would only reprint the old address as if something
      // had happened.
      setSent(asked);
      setNewEmail("");
      setPassword("");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 border-t pt-8" onSubmit={(e) => void submit(e)}>
      <h2 className="text-sm font-medium">Email</h2>
      <p className="text-muted-foreground text-sm">
        You sign in with{" "}
        <span className="text-foreground font-medium" data-testid="account-email">
          {email}
        </span>
        , and it is where a password reset is sent.
      </p>
      {/* Above the fields, not instead of them: a second attempt with a
          different address must not need a page reload. */}
      {sent ? (
        <p className="text-sm" data-testid="email-sent">
          Check <span className="font-medium">{sent}</span> for a link. Nothing has changed yet —{" "}
          {email} keeps working until that link is used.
        </p>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="new-email">New email</Label>
        <Input
          id="new-email"
          type="email"
          data-testid="email-new"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email-password">Password</Label>
        <Input
          id="email-password"
          type="password"
          data-testid="email-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button
        type="submit"
        className="w-fit"
        data-testid="email-submit"
        disabled={pending || !newEmail.trim() || !password}
      >
        {pending ? "Sending…" : "Change email"}
      </Button>
    </form>
  );
}
