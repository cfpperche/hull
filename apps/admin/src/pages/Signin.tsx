import { useState } from "react";
import { Button, Input, Label } from "@hull/ui";
import { errMsg } from "@hull/api-client";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function SigninPage() {
  const { refreshMe } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api.signin({ email: email.trim(), password });
      await refreshMe();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-sm gap-6 px-6 py-16">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground mt-1 text-sm">Platform operators only.</p>
      </div>
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" data-testid="auth-email" type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" data-testid="auth-password" type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" data-testid="auth-submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
