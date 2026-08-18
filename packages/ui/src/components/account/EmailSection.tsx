import { useState } from "react";
import type { HullApi } from "@hull/api-client";
import { errMsg } from "@hull/api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Fill, useT } from "../LocaleProvider";

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
  const t = useT();
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
      <h2 className="text-sm font-medium">{t("account.email.title")}</h2>
      <p className="text-muted-foreground text-sm">
        {/* The address is a node inside the sentence, not two sentences glued
            around it: word order around it is the translator's to change. */}
        <Fill
          parts={t.parts("account.email.blurb")}
          nodes={{
            email: (
              <span
                className="text-foreground font-medium"
                data-testid="account-email"
              >
                {email}
              </span>
            ),
          }}
        />
      </p>
      {/* Above the fields, not instead of them: a second attempt with a
          different address must not need a page reload. */}
      {sent ? (
        <p className="text-sm" data-testid="email-sent">
          <Fill
            parts={t.parts("account.email.sent", { email })}
            nodes={{ newEmail: <span className="font-medium">{sent}</span> }}
          />
        </p>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="new-email">{t("account.email.new")}</Label>
        <Input
          id="new-email"
          type="email"
          data-testid="email-new"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email-password">{t("account.email.password")}</Label>
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
        {pending ? t("account.email.sending") : t("account.email.submit")}
      </Button>
    </form>
  );
}
